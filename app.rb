require "sinatra"
require "faye/websocket"
require "serialport"
require_relative "streamer"

set :server, "puma"
set :public_folder, "public"
set :uploads, File.expand_path("uploads", __dir__)

$clients = []
# $streamer = GcodeStreamer.new("/dev/ttyUSB0", 115200)

get '/' do
  send_file File.join(settings.public_folder, 'index.html')
end

# WebSocket endpoint
get "/ws" do
  if Faye::WebSocket.websocket?(env)
    ws = Faye::WebSocket.new(env)
    $clients << ws

    ws.on :message do |event|
      data = event.data
      cmd, arg = data.split(":", 2)
      # case cmd
      # when "start" then $streamer.start(arg)
      # when "stop"  then $streamer.stop
      # end
    end

    ws.on :close do
      $clients.delete(ws)
      ws = nil
    end

    ws.rack_response
  else
    status 400
  end
end

# Upload endpoint
post "/upload" do
  file = params[:file][:tempfile]
  filename = params[:file][:filename]
  path = File.join(settings.uploads, filename)
  FileUtils.mv(file.path, path)
  "Uploaded #{filename}"
end
