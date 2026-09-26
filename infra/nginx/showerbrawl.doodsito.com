# Copy to /etc/nginx/sites-available/ and symlink into sites-enabled/.
# Same pattern as eivom-api.doodsito.com: Cloudflare proxy -> host nginx
# (TLS with the *.doodsito.com Cloudflare Origin cert) -> Docker app on 127.0.0.1,
# plus the WebSocket upgrade headers Socket.io needs.

server {
    listen 80;
    server_name showerbrawl.doodsito.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name showerbrawl.doodsito.com;

    ssl_certificate /etc/ssl/cloudflare/doodsito.pem;
    ssl_certificate_key /etc/ssl/cloudflare/doodsito.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
    }
}
