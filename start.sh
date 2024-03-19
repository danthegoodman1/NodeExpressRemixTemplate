tailscaled --tun=userspace-networking --socks5-server=localhost:1055 &>/dev/null &
tailscale up --authkey=$TS_AUTHKEY --ssh --hostname=$TS_HOSTNAME &&
litestream replicate -config /app/litestream.yml -exec "npm start"
