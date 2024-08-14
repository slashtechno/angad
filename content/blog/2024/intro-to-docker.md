---
title: Introduction to Docker
date: 2024-08-14
lastmod: 2024-08-14
draft: true
tags: ["self-hosting"]
categories: ["guides"]
# summary: Learn Docker in a way that should prevent unnecessary Stack Overflow visits
description: An introduction to Docker and Docker Compose
---

## What’s Docker?
Docker is a tool for containerizing software. In _some_ cases, it can replace a VM. Each _container_ has it’s own filesystem. However, core system components are shared. **The container uses the host’s kernel.**
### Speed! ⚡ 
Due to the shared kernel, containers can run extremely fast. Imagine setting up an Ubuntu Server VM. Most would not consider the startup time insignificant. Now, try running a Docker Container.

A quick note, if you’re on Linux, you may have to use `sudo`.
## Running your first container
`docker run -it --rm ubuntu:latest bash`
### Explanation:
* `docker run`: Run a container
* `-it`: Allows interactive usage with the TTY
  * Combination of `-i`  and `-t`
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
Now's probably a good time to talk about images. A Docker image is made up of layers. Each layer is a change to the filesystem. In past examples, we've been using images made by others. However, you can create your own images. This is done with a `Dockerfile`.
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