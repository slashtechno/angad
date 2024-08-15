---
title: Introduction to Docker
date: 2024-08-14
lastmod: 2024-08-15
draft: false
tags: ["self-hosting", "Hack Club"]
categories: ["guides"]
summary: "Learn the basics of Docker including: running containers, creating images, and using Docker Compose"
description: A practical introduction to Docker and Docker Compose
---
<!-- I wrote this for a virtual workshop I hosted for Hack Club. The workshop was an introduction to Docker and Docker Compose. -->

## What’s Docker?
Docker is a tool for containerizing software. In _some_ cases, it can replace a VM. Each _container_ has its own file system. However, core system components are shared. **The container uses the host’s kernel.**
### Speed ⚡
Due to the shared kernel, containers can run extremely fast. Imagine setting up an Ubuntu Server VM. Most would not consider the startup time insignificant. Now, try running a Docker Container.

## Prerequisites  
You need to have Docker installed. You can find the installation instructions [here](https://docs.docker.com/get-docker/).  
If you're on macOS or Windows, I recommend using Docker Desktop as that should easily integrate with WSL on Windows and on macOS, it should create a VM. On Linux, you probably should just run the [installation script](https://get.docker.com/). Run this with `curl -fsSL https://get.docker.com | sh`. If you want to first see what the script does without making changes to your system, you can run `curl -fsSL https://get.docker.com/ | sh -s -- --dry-run`.

A quick note, if you’re on Linux, you will probably have to use `sudo`. 

## Running your first container
`docker run -it --rm ubuntu:latest bash`
### Explanation:
* `docker run`: Run a container
* `-it`: Allows interactive usage with the TTY
  * Combination of `-i` and `-t`
* `--rm`: Delete container when it stops
* `bash`: Execute `bash` in the container in order to run commands
### Usage:
You _should_ be in `bash` now. You’re `root`, so no need to prepend commands with `sudo`.
Try running `apt install neofetch -y`. This _probably_ won’t work. Run `apt update` and try installing `neofetch` again. Running `neofetch` should work now. 
```
            .-/+oossssoo+/-.               root@4015f9430120
        `:+ssssssssssssssssss+:`           -----------------
      -+ssssssssssssssssssyyssss+-         OS: Ubuntu 24.04 LTS on Windows 10 x86_64
    .ossssssssssssssssssdMMMNysssso.       Kernel: 5.10.102.1-microsoft-standard-WSL2
   /ssssssssssshdmmNNmmyNMMMMhssssss/      Uptime: 3 hours, 23 mins
  +ssssssssshmydMMMMMMMNddddyssssssss+     Packages: 257 (dpkg)
 /sssssssshNMMMyhhyyyyhmNMMMNhssssssss/    Shell: bash 5.2.21
.ssssssssdMMMNhsssssssssshNMMMdssssssss.   CPU: 11th Gen Intel i7-11800H (16) @ 2.304GHz
+sssshhhyNMMNyssssssssssssyNMMMysssssss+   GPU: 679a:00:00.0 Microsoft Corporation Basic Render Driver
ossyNMMMNyMMhsssssssssssssshmmmhssssssso   Memory: 824MiB / 7811MiB
ossyNMMMNyMMhsssssssssssssshmmmhssssssso
+sssshhhyNMMNyssssssssssssyNMMMysssssss+
.ssssssssdMMMNhsssssssssshNMMMdssssssss.
 /sssssssshNMMMyhhyyyyhdNMMMNhssssssss/
  +sssssssssdmydMMMMMMMMddddyssssssss+
   /ssssssssssshdmNNNNmyNMMMMhssssss/
    .ossssssssssssssssssdMMMNysssso.
      -+sssssssssssssssssyyyssss+-
        `:+ssssssssssssssssss+:`
            .-/+oossssoo+/-.
```

## Running Caddy (a web server) in Docker
By default, when you delete a container, all data is lost. To persist data, you can use volumes! Technically, what we're doing here is a [bind-mount](https://docs.docker.com/engine/storage/bind-mounts/), not really a [volume](https://docs.docker.com/engine/storage/volumes/). In some cases, you might want to use a volume. In addition, the `--mount` flag is preferred over `-v` as it's more explicit. However, for simplicity, we'll use `-v`.
### Creating an index.html file
```sh
# Create a directory for the files
mkdir caddy-website
cd caddy-website
# Create an index.html file
echo "hello world" > caddy-website/index.html
```  
### Running Caddy
```
docker run -d --name caddy -p 2048:80 -v $(pwd)/caddy-website:/usr/share/caddy caddy:latest
```
You now should be able to access the website at [`http://localhost:2048`](http://localhost:2048)!
#### Explanation:
* `-d`: Run the container in the background
* `--name caddy`: Name the container `caddy`
* `-p 2048:80`: Map port 2048 on the host to port 80 in the container
* `-v $(pwd)/caddy-website:/usr/share/caddy`: Bind-mount the `caddy-website` directory to `/usr/share/caddy` in the container
    * You _could_ skip creating the directory and just bind-mount the file with `-v $PWD/index.html:/usr/share/caddy/index.html`
* `caddy:latest`: Use the `caddy:latest` image
#### Keep in mind:  
We're running in the background with `-d`. However, this doesn't mean the container will restart on boot, failure, or when Docker restarts. To have the container restart, add `--restart unless-stopped`. There are other [restart policies](https://docs.docker.com/engine/containers/start-containers-automatically/) as well, but `unless-stopped` will probably be the one you use most.  
Also, since we're running in the background, you won't see any output. To see the logs, run `docker logs caddy`. Running `docker logs -f caddy` will _follow_ the logs, allowing you to see new logs as they're generated.
#### Controlling the container  
Since we're running the container in the background, you might want to stop it. To stop the container, run `docker stop caddy`. To start it again, run `docker start caddy`. To remove the container, run `docker rm caddy`.  

## Images  
Now's probably a good time to talk about images. A Docker image is made up of layers. Each layer is a change to the file system. In past examples, we've been using images made by others. However, you can create your own images. This is done with a `Dockerfile`.
### Creating a Dockerfile
Create a file called `Dockerfile` with the following contents:  
```Dockerfile
FROM alpine:latest
ENTRYPOINT ["echo"]
```
Alternatively, you can run the following commands to do the same thing:  
```sh
echo "FROM alpine:latest" >> Dockerfile
echo 'ENTRYPOINT ["echo"]' >> Dockerfile
```
#### Explanation:
* `FROM alpine:latest`: Use the `alpine:latest` image as the base image
    * Alpine is a lightweight Linux distribution often used in containers
* `ENTRYPOINT ["echo"]`: Set the entrypoint to `echo`
    * This means that when the container starts, it will run `echo` with any arguments passed to the container
### Building the image
Run `docker build -t echo .` in the same directory as the `Dockerfile`. This will build the image with the tag `echo`.  
* To build the image with a different tag, run `docker build -t <tag> .`
    * In some cases, you would want the registry to be included in the tag. For example, `docker build -t ghcr.io/username/echo .` for the GitHub Container Registry
    * If, for whatever reason, the Dockerfile is not, in fact, called `Dockerfile`, you can specify the file with `docker build -t echo -f <filename> .`
### Running the image  
Run `docker run --rm echo Hello, Docker!`.  
* `--rm`: Remove the container when it stops
* `echo`: The image to run
* `Hello, Docker!`: The argument to pass to `echo`

## Docker Compose  
Using `docker run` can get tedious. For example, if you have multiple containers that need to be run together, you would have to run multiple `docker run` commands. When you want to stop them, get logs, etc., you would have to do the same. This is where Docker Compose comes in.  
Note that `docker-compose` has effectively been superseded by `docker compose`.  
### Running a desktop environment in Docker  
[LinuxServer](https://www.linuxserver.io/) is a group you may come across when self-hosting. They provide Docker images for a variety of services. In this example, we'll be using their [Webtop](https://github.com/linuxserver/docker-webtop) image. In some cases, you can clone the repository and run `docker-compose up`. However, it can be easier to just download the `docker-compose.yml` in its own directory. Docker will use the directory name to name containers, which is why I try to keep Compose files in a directory dedicated to the service or the cloned repository.  
Webtop is a project that provides a web interface for a desktop environment. It uses KasmVNC which allows for remote desktop access through the browser. The latency has been quite good in my experience and audio works as well. Some other nice features include file-transfer, clipboard sharing, and multiple displays. If you just want a specific application, LinuxServer also has KasmVNC images for apps like [Firefox](https://fleet.linuxserver.io/image?name=linuxserver/firefox). 
#### Create and navigate to a directory for the Webtop service  
```sh
mkdir webtop
cd webtop
```
#### Create the `docker-compose.yml` file  
The `linxuserver/webtop` image doesn't have a `docker-compose.yml` file. It does, however, have example contents of what the file should look like in the README. I've edited the example slightly. Refer to the repository for the more, possibly updated, information.  
```yaml
services:
  webtop:
    # Use the Ubuntu Webtop image with the MATE desktop environment
    image: lscr.io/linuxserver/webtop:ubuntu-mate	
    # The name of the container
    container_name: webtop
    environment:
      # PUID and PGID are the user and group IDs of the user running the container
      # These help with file permissions
      # You can find these by running `id` in the terminal or by running `id -u` and `id -g`
      - PUID=1000
      - PGID=1000
      # TZ is the timezone 
      - TZ=Etc/UTC
      # TITLE (optional) is the title of the web interface
      - TITLE=Webtop
      # Set HTTP authentication (optional)
      - CUSTOM_USER=user
      - CUSTOM_PASS=password   
    volumes:
      # Mount /config (set as the home directory) to the `home` in the current directory 
      - ./home:/config
      # Optionally, allow for Docker in Docker by sharing the Docker socket
      # The Webtop image has the Docker binary. If you're running an image that doesn't, install Docker in the container first.
      - /var/run/docker.sock:/var/run/docker.sock 
    ports:
      # Port 3000 is the web interface (kasmVNC)
      # Port 3001 is the  web interface (kasmVNC) with HTTPS
      - 3000:3000
      - 3001:3001
    # devices:
      # This optional mount should help with hardware acceleration (host should be Linux)
      # - /dev/dri:/dev/dri
    # The README mentions that this helps prevent web browsers from crashing
    shm_size: "1gb"
    # Restart the container unless stopped manually
    restart: unless-stopped
```
#### Running the Docker Compose file
Run `docker compose up -d` in the same directory as the `docker-compose.yml` file. To run it in the foreground, remove the `-d`. To remove the container, run `docker compose down`.  

## Some cool projects to check out  
* [Portainer](https://www.portainer.io/): A web interface for managing Docker containers
  * [Portainer CE Installation](https://docs.portainer.io/start/install-ce)
* [Docker-OSX](https://github.com/sickcodes/Docker-OSX): Run macOS in Docker
  * Runs a container that runs QEMU in order to virtualize macOS  
  * It can generate serial numbers and board IDs meaning iMessage works!
  * Can be accessed through X11 forwarding or VNC
* [dockur/windows](https://github.com/dockur/windows): Run Windows in Docker
  * Uses QEMU to virtualize Windows
  * Can be accessed through a web browser or via RDP
  * If you're on an ARM64 machine, like the Raspberry Pi, [dockur/windows-arm](https://github.com/dockur/windows-arm/) is available
* [dock-droid](https://github.com/sickcodes/dock-droid): Run Android in Docker
  * Like the above two, uses QEMU
  * Can be accessed through X11 forwarding or VNC