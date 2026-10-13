import ExpoModulesCore
import Darwin

private final class UdpSocket {
  let fd: Int32
  private let source: DispatchSourceRead

  init(fd: Int32, onMessage: @escaping (Data, String) -> Void) {
    self.fd = fd
    source = DispatchSource.makeReadSource(fileDescriptor: fd, queue: DispatchQueue(label: "bimmerdisco.udp.read"))

    source.setEventHandler {
      var buffer = [UInt8](repeating: 0, count: 2048)
      var from = sockaddr_in()
      var fromLength = socklen_t(MemoryLayout<sockaddr_in>.size)

      let count = withUnsafeMutablePointer(to: &from) { pointer in
        pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
          recvfrom(fd, &buffer, buffer.count, 0, $0, &fromLength)
        }
      }
      guard count > 0 else { return }

      var address = from.sin_addr
      var host = [CChar](repeating: 0, count: Int(INET_ADDRSTRLEN))
      inet_ntop(AF_INET, &address, &host, socklen_t(INET_ADDRSTRLEN))

      onMessage(Data(buffer[0..<count]), String(cString: host))
    }
    source.setCancelHandler { Darwin.close(fd) }
    source.resume()
  }

  func close() {
    source.cancel()
  }
}

private final class UdpException: GenericException<String>, @unchecked Sendable {
  override var reason: String { param }
}

public class BimmerDiscoUdpModule: Module {
  private var sockets: [Int: UdpSocket] = [:]
  private var nextId = 1
  private let lock = NSLock()

  public func definition() -> ModuleDefinition {
    Name("BimmerDiscoUdp")

    Events("onMessage")

    AsyncFunction("open") { () -> Int in
      let fd = Darwin.socket(AF_INET, SOCK_DGRAM, 0)
      guard fd >= 0 else { throw UdpException("socket() failed: errno \(errno)") }

      var enabled: Int32 = 1
      var address = sockaddr_in()
      address.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
      address.sin_family = sa_family_t(AF_INET)
      address.sin_addr.s_addr = INADDR_ANY.bigEndian

      let broadcastEnabled = setsockopt(fd, SOL_SOCKET, SO_BROADCAST, &enabled, socklen_t(MemoryLayout<Int32>.size)) == 0
      let nonBlocking = fcntl(fd, F_SETFL, O_NONBLOCK) != -1
      let bound = withUnsafePointer(to: &address) {
        $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
          Darwin.bind(fd, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
        }
      } == 0
      guard broadcastEnabled && nonBlocking && bound else {
        let code = errno
        Darwin.close(fd)
        throw UdpException("socket setup failed: errno \(code)")
      }

      self.lock.lock()
      defer { self.lock.unlock() }
      let id = self.nextId
      self.nextId += 1
      self.sockets[id] = UdpSocket(fd: fd) { [weak self] data, host in
        self?.sendEvent("onMessage", ["id": id, "data": data.base64EncodedString(), "host": host])
      }

      return id
    }

    AsyncFunction("send") { (id: Int, base64: String, host: String, port: Int) in
      guard let udp = self.openSocket(id) else { throw UdpException("socket \(id) is closed") }
      guard let payload = Data(base64Encoded: base64) else { throw UdpException("invalid payload") }

      var target = sockaddr_in()
      target.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
      target.sin_family = sa_family_t(AF_INET)
      target.sin_port = UInt16(port).bigEndian
      guard inet_pton(AF_INET, host, &target.sin_addr) == 1 else { throw UdpException("invalid host \(host)") }

      let sent = payload.withUnsafeBytes { bytes in
        withUnsafePointer(to: &target) {
          $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
            sendto(udp.fd, bytes.baseAddress, payload.count, 0, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
          }
        }
      }
      guard sent == payload.count else { throw UdpException("sendto failed: errno \(errno)") }
    }

    Function("close") { (id: Int) in
      self.removeSocket(id)?.close()
    }

    Function("getBroadcastAddresses") { () -> [String] in
      Self.broadcastAddresses()
    }

    OnDestroy {
      self.lock.lock()
      let open = Array(self.sockets.values)
      self.sockets.removeAll()
      self.lock.unlock()
      open.forEach { $0.close() }
    }
  }

  private func openSocket(_ id: Int) -> UdpSocket? {
    lock.lock()
    defer { lock.unlock() }
    return sockets[id]
  }

  private func removeSocket(_ id: Int) -> UdpSocket? {
    lock.lock()
    defer { lock.unlock() }
    return sockets.removeValue(forKey: id)
  }

  private static func broadcastAddresses() -> [String] {
    var list: UnsafeMutablePointer<ifaddrs>?
    guard getifaddrs(&list) == 0, let first = list else { return [] }
    defer { freeifaddrs(list) }

    var result: [String] = []
    for entry in sequence(first: first, next: { $0.pointee.ifa_next }) {
      let flags = Int32(entry.pointee.ifa_flags)
      guard flags & IFF_UP != 0, flags & IFF_BROADCAST != 0, flags & IFF_LOOPBACK == 0,
            let destination = entry.pointee.ifa_dstaddr,
            destination.pointee.sa_family == sa_family_t(AF_INET) else { continue }

      var address = destination.withMemoryRebound(to: sockaddr_in.self, capacity: 1) { $0.pointee.sin_addr }
      var host = [CChar](repeating: 0, count: Int(INET_ADDRSTRLEN))
      inet_ntop(AF_INET, &address, &host, socklen_t(INET_ADDRSTRLEN))
      result.append(String(cString: host))
    }

    return result
  }
}
