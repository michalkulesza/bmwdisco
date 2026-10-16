package expo.modules.bimmerdiscoadapters

import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.content.Context
import android.content.Intent
import android.app.PendingIntent
import android.hardware.usb.UsbManager
import android.util.Base64
import com.hoho.android.usbserial.driver.UsbSerialPort
import com.hoho.android.usbserial.driver.UsbSerialProber
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

private val SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

class BimmerDiscoAdaptersModule : Module() {
  private class Connection {
    @Volatile var socket: BluetoothSocket? = null
    @Volatile var usb: UsbSerialPort? = null
    val closed = AtomicBoolean(false)
  }
  private val connections = ConcurrentHashMap<String, Connection>()
  private val timer = Executors.newSingleThreadScheduledExecutor()

  override fun definition() = ModuleDefinition {
    Name("BimmerDiscoAdapters")
    Events("onData", "onClosed")

    AsyncFunction("listBondedDevices") {
      adapter().bondedDevices.map { mapOf("id" to it.address, "name" to (it.name ?: it.address)) }
    }

    AsyncFunction("listUsbDevices") {
      UsbSerialProber.getDefaultProber().findAllDrivers(usbManager()).flatMap { driver ->
        driver.ports.mapIndexed { index, _ -> mapOf(
          "id" to "${driver.device.deviceId}:$index",
          "name" to "${driver.device.productName ?: driver.javaClass.simpleName} ($index)"
        ) }
      }
    }

    AsyncFunction("open") { id: String, kind: String, deviceId: String, timeoutMs: Int, baudRate: Int, parity: Int, promise: Promise ->
      if (kind != "bluetooth" && kind != "usb") {
        promise.reject("profile-unsupported", "Unsupported serial transport", null)
      } else {
        val connection = Connection()
        if (connections.putIfAbsent(id, connection) != null) {
          promise.reject("connect-failed", "Connection already exists", null)
        } else {
          val settled = AtomicBoolean(false)
          val deadline = timer.schedule({
            closeConnection(id, connection)
            if (settled.compareAndSet(false, true)) promise.reject("timeout", "Serial connection timed out", null)
          }, timeoutMs.toLong().coerceIn(1, 60000), TimeUnit.MILLISECONDS)
          Thread {
            try {
              if (kind == "usb") {
                openUsb(connection, deviceId, baudRate, parity)
              } else {
                val bluetooth = adapter()
                val context = appContext.reactContext ?: throw IllegalStateException("Android context unavailable")
                if (Build.VERSION.SDK_INT < 31 || context.checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED) {
                  bluetooth.cancelDiscovery()
                }
                val device = bluetooth.getRemoteDevice(deviceId)
                try {
                  val socket = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID)
                  installSocket(connection, socket)
                  socket.connect()
                } catch (first: Exception) {
                  connection.socket?.close()
                  if (connection.closed.get()) throw first
                  // Android adapter retries RFCOMM channel 1 for adapters without a working SDP record.
                  val socket = device.javaClass.getMethod("createRfcommSocket", Int::class.javaPrimitiveType)
                    .invoke(device, 1) as BluetoothSocket
                  installSocket(connection, socket)
                  socket.connect()
                }
              }
              if (connection.closed.get()) throw IllegalStateException("Connection cancelled")
              if (settled.compareAndSet(false, true)) {
                deadline.cancel(false)
                promise.resolve(null)
                read(id, connection)
              }
            } catch (error: Exception) {
              deadline.cancel(false)
              closeConnection(id, connection)
              if (settled.compareAndSet(false, true)) promise.reject("connect-failed", error.message, error)
            }
          }.apply { name = "BimmerDisco-connect"; isDaemon = true }.start()
        }
      }
    }

    AsyncFunction("write") { id: String, base64: String, promise: Promise ->
      val connection = connections[id]
      if (connection == null) {
        promise.reject("closed", "Serial connection closed", null)
      } else {
        val settled = AtomicBoolean(false)
        val deadline = timer.schedule({
          closeConnection(id, connection)
          if (settled.compareAndSet(false, true)) {
            promise.reject("write-failed", "Serial write timed out", null)
            sendEvent("onClosed", mapOf("id" to id, "message" to "Serial write timed out"))
          }
        }, 5, TimeUnit.SECONDS)
        Thread {
          try {
            synchronized(connection) {
              check(!connection.closed.get()) { "Serial connection closed" }
              val payload = Base64.decode(base64, Base64.NO_WRAP)
              val usb = connection.usb
              if (usb != null) {
                usb.write(payload, 5000)
              } else {
                val socket = connection.socket ?: throw IllegalStateException("Serial connection closed")
                socket.outputStream.write(payload)
                socket.outputStream.flush()
              }
            }
            if (settled.compareAndSet(false, true)) promise.resolve(null)
          } catch (error: Exception) {
            if (settled.compareAndSet(false, true)) promise.reject("write-failed", error.message, error)
          } finally { deadline.cancel(false) }
        }.apply { name = "BimmerDisco-write"; isDaemon = true }.start()
        }
    }

    Function("close") { id: String ->
      connections[id]?.let { closeConnection(id, it) }
    }

    OnDestroy {
      connections.forEach { (id, connection) -> closeConnection(id, connection) }
      timer.shutdownNow()
    }
  }

  private fun adapter(): android.bluetooth.BluetoothAdapter {
    val context = appContext.reactContext ?: throw IllegalStateException("Android context unavailable")
    val adapter = (context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter
      ?: throw IllegalStateException("Bluetooth is unavailable")
    check(adapter.isEnabled) { "Bluetooth is turned off" }
    return adapter
  }

  private fun usbManager(): UsbManager {
    val context = appContext.reactContext ?: throw IllegalStateException("Android context unavailable")
    return context.getSystemService(Context.USB_SERVICE) as UsbManager
  }

  private fun openUsb(connection: Connection, deviceId: String, baudRate: Int, parity: Int) {
    val parts = deviceId.split(":")
    require(parts.size == 2) { "Invalid USB device selection" }
    val manager = usbManager()
    val driver = UsbSerialProber.getDefaultProber().findAllDrivers(manager)
      .firstOrNull { it.device.deviceId.toString() == parts[0] }
      ?: throw IllegalStateException("USB adapter is no longer attached")
    val port = driver.ports.getOrNull(parts[1].toInt()) ?: throw IllegalStateException("USB port unavailable")
    if (!manager.hasPermission(driver.device)) {
      val context = appContext.reactContext ?: throw IllegalStateException("Android context unavailable")
      val intent = Intent("${context.packageName}.USB_PERMISSION").setPackage(context.packageName)
      manager.requestPermission(driver.device, PendingIntent.getBroadcast(context, driver.device.deviceId, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
      while (!manager.hasPermission(driver.device) && !connection.closed.get()) Thread.sleep(100)
    }
    synchronized(connection) {
      check(!connection.closed.get()) { "Connection cancelled" }
      val deviceConnection = manager.openDevice(driver.device) ?: throw IllegalStateException("USB permission denied or adapter detached")
      connection.usb = port
      try {
        port.open(deviceConnection)
        port.setParameters(baudRate, 8, UsbSerialPort.STOPBITS_1, parity)
        port.setFlowControl(UsbSerialPort.FlowControl.NONE)
      } catch (error: Exception) { deviceConnection.close(); throw error }
    }
  }

  private fun installSocket(connection: Connection, socket: BluetoothSocket) {
    synchronized(connection) {
      if (connection.closed.get()) { socket.close(); throw IllegalStateException("Connection cancelled") }
      connection.socket = socket
    }
  }

  private fun closeConnection(id: String, connection: Connection) {
    connection.closed.set(true)
    connections.remove(id, connection)
    try { connection.socket?.close() } catch (_: Exception) { }
    try { connection.usb?.close() } catch (_: Exception) { }
  }

  private fun read(id: String, connection: Connection) {
    try {
      val buffer = ByteArray(4096)
      while (!connection.closed.get()) {
        val count = connection.usb?.read(buffer, 1000) ?: connection.socket!!.inputStream.read(buffer)
        if (count < 0) throw IllegalStateException("Serial connection closed by adapter")
        if (count > 0) sendEvent("onData", mapOf("id" to id, "base64" to Base64.encodeToString(buffer.copyOf(count), Base64.NO_WRAP)))
      }
    } catch (error: Exception) {
      if (!connection.closed.get()) sendEvent("onClosed", mapOf("id" to id, "message" to (error.message ?: "Serial connection closed")))
    } finally { closeConnection(id, connection) }
  }
}
