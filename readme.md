# Hallo Laserpi

## Let's get things setup
On your PI Run:

```
sudo apt update
sudo apt install --no-install-recommends xserver-xorg x11-xserver-utils xinit openbox chromium
```

To Autostart Chromium in Kisok mode in Put the following in `~/.config/openbox/autostart`

```
xset s off
xset -dpms
xset s noblank
chromium-browser --kiosk --incognito --app=http://localhost:3000 --noerrdialogs --disable-translate &
```

Ensure your Ruby app is systemd-managed (example `/etc/systemd/system/pi-gcode.service`)

```
[Unit]
Description=Pi G-code Streamer
After=network.target

[Service]
ExecStart=/usr/bin/env ruby /home/pi/pi_gcode_streamer/app.rb -p 3000
WorkingDirectory=/home/pi/pi_gcode_streamer
Restart=always
User=pi
Environment=RACK_ENV=production

[Install]
WantedBy=multi-user.target
```

In the terminal Run:
```
sudo systemctl daemon-reload
sudo systemctl enable pi-gcode
sudo systemctl start pi-gcode
```