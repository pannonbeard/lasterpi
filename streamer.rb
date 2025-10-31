require "serialport"

class GcodeStreamer
  def initialize(port_path, baud)
    @serial = SerialPort.new(port_path, baud, 8, 1, SerialPort::NONE)
    @running = false
  end

  def start(filename)
    return if @running
    @running = true
    Thread.new do
      File.readlines(File.join(__dir__, "uploads", filename)).each do |line|
        break unless @running
        next if line.strip.empty?

        @serial.puts(line)
        sleep 0.05  # tune as needed
        wait_for_ok
        broadcast("progress:#{line.strip}")
      end
      broadcast("complete")
      @running = false
    end
  end

  def stop
    @running = false
  end

  private

  def wait_for_ok
    buffer = ""
    until buffer.include?("ok")
      buffer << @serial.gets.to_s
    end
  end

  def broadcast(message)
    $clients.each { |ws| ws.send(message) }
  end
end
