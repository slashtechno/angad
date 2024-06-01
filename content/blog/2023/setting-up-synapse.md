---
title: Self-hosting a Matrix Server With Synapse
date: 2023-09-02
# summary: 
draft: false
# tags: ["github", "software"]
description: Running Synapse in Docker to self-host a Matrix instance 
---  
Matrix is a versatile protocol for communication. Similar to ActivityPub, which Mastodon uses, Matrix supports federation. Thus, by self-hosting, you're using your own server whilst also being able to use your own domain.  


### Setup  
Assuming Docker is installed, the first step is to generate the configuration file.  
The following command will generate a configuration file in `./synapse-data`. Change `matrix.example.com` to the domain that will be used. If you're running in Powershell, replace `\` with `^`
```
docker run -it --rm \
    -v $(pwd)/synapse-data:/data \
    -e SYNAPSE_SERVER_NAME=matrix.example.com \
    -e SYNAPSE_REPORT_STATS=no \
    matrixdotorg/synapse:latest generate
```

### Configuration
Running the server now would result in a problem; registration and federation are not currently set up.  
#### Registration  
By default, registration is disabled. To [enable](https://matrix-org.github.io/synapse/latest/usage/configuration/config_documentation.html#enable_registration_without_verification) it, edit `./synapse-data/homeserver.yaml` and add the following:
```
enable_registration: true
enable_registration_without_verification: true

```  
However, this is not recommended as this can lead to spam. Instead, some verification method should be used if registration is to be enabled. Using reCAPTCHA is one option. The Synapse documentation has a [tutorial](https://matrix-org.github.io/synapse/latest/CAPTCHA_SETUP.html) regarding this.  
<!-- https://github.com/zeratax/matrix-registration -->  
#### Federation  
Federation allows Matrix servers to communicate. By default, it's expected that the server is run on port 8448 with TLS. However, in some scenarios, this may not be the configuration. For example, I run Synapse in Docker on port 8007. On the host, Nginx is installed with the following configuration, with a different hostname, in `/etc/nginx/sites-available/matrix-federation`:  
```
server {
    listen 8008;
    location /.well-known/matrix/server {
        add_header Content-Type application/json;
        return 200 '{"m.server": "matrix.example.com:443"}';
    }
    location / {
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_pass http://localhost:8007;
    }
}
```  
I use Cloudflare tunnel to proxy my Matrix subdomain, on port 443, to `<host IP>:8007`. However, a similar Nginx config can be used for federation as well. Just make sure that `http://localhost:8007` points to the Docker container and `matrix.example.com:443` points to the address where Matrix can be accessed from outside your network.  


### Running the Server
The following command runs the server on port 8007. Note that you will need a client to use it.  
```
docker run -d --name synapse \
    --name synapse \
    --restart unless-stopped \
    -itd \
    -v $(pwd)/synapse-data:/data \
    -p 8007:8008 \
    matrixdotorg/synapse:latest
```

### Useful links  
* [Cinny](https://cinny.in/) - A Matrix client
* [synapse-admin](https://github.com/Awesome-Technologies/synapse-admin) - Manage your Synapse instance from a web based interface  
* [matrixdotorg/synapse](https://hub.docker.com/r/matrixdotorg/synapse) - The Synapse Docker image with a useful README
* [Self hosting your own Matrix server on a Raspberry Pi](https://theselfhostingblog.com/posts/self-hosting-your-own-matrix-server-on-a-raspberry-pi/) - One of the tutorials I used  
* [How to Install Matrix Synapse Homeserver Using Docker](https://linuxhandbook.com/install-matrix-synapse-docker/) - One of the tutorials I used  

### One more thing  
This is a simple setup and configuration. This is similar to how I run my Synapse server (at the time of writing). However, it isn't necessarily the best configuration. 