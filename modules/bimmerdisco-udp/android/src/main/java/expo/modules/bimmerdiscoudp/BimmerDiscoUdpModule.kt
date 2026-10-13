package expo.modules.bimmerdiscoudp

import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.NetworkInterface
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

private const val MAX_DATAGRAM_BYTES = 2048

class BimmerDiscoUdpModule : Module() {
  private val sockets = ConcurrentHashMap<Int, DatagramSocket>()
  private val nextId = AtomicInteger(1)

  override fun definition() = ModuleDefinition {
    Name("BimmerDiscoUdp")

    Events("onMessage")

    AsyncFunction("open") {
      val socket = DatagramSocket()
      socket.broadcast = true
      val id = nextId.getAndIncrement()
      sockets[id] = socket
      startReading(id, socket)
      id
    }

    AsyncFunction("send") { id: Int, base64: String, host: String, port: Int ->
      val socket = sockets[id] ?: throw IllegalStateException("socket $id is closed")
      val payload = Base64.decode(base64, Base64.NO_WRAP)
      socket.send(DatagramPacket(payload, payload.size, InetAddress.getByName(host), port))
    }

    Function("close") { id: Int ->
      sockets.remove(id)?.close()
      Unit
    }

    Function("getBroadcastAddresses") {
      NetworkInterface.getNetworkInterfaces().toList()
        .filter { it.isUp && !it.isLoopback }
        .flatMap { it.interfaceAddresses }
        .mapNotNull { it.broadcast?.hostAddress }
        .distinct()
    }

    OnDestroy {
      sockets.values.forEach { it.close() }
      sockets.clear()
    }
  }

  private fun startReading(id: Int, socket: DatagramSocket) {
    Thread {
      val buffer = ByteArray(MAX_DATAGRAM_BYTES)
      while (!socket.isClosed) {
        try {
          val packet = DatagramPacket(buffer, buffer.size)
          socket.receive(packet)
          sendEvent(
            "onMessage",
            mapOf(
              "id" to id,
              "data" to Base64.encodeToString(packet.data, 0, packet.length, Base64.NO_WRAP),
              "host" to packet.address.hostAddress,
            ),
          )
        } catch (_: Exception) {
          if (socket.isClosed) break
        }
      }
    }.apply {
      isDaemon = true
      name = "bimmerdisco-udp-$id"
      start()
    }
  }
}
