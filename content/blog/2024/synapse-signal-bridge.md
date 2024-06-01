---
title: Simple Signal-Matrix Bridge in Docker
date: 2024-02-03
# summary: 
draft: false
# tags: ["signal", "matrix"]
description: Setting up a (simple) bridge between Matrix and Signal
---  
## A short introduction  
In September of 2023, I wrote a [post](/blog/2023/setting-up-synapse/) regarding the setup of a simple Matrix server. Personally, I think that Matrix is a cool protocol, but I don't use it much (at the time of writing). However, I love the ability to bridge chat services. Beeper, the company which has recently been in the news for developing a native Android iMessage client, originally started out bridging chat services. Whilst their service itself is proprietary (at the time of writing), the bridges they use are open source. They even have a [guide](https://github.com/beeper/self-host) on how to self-host various bridges and Matrix with Ansible. I have not gotten around to learning Ansible so I manually set up various Docker containers which allows for a similar result.

## Setup
I have a Synapse server running in Docker on port 8007 locally. Thus, the following instructions assume that Synapse is running on port 8007. If you're running Synapse on a different port, change the port in the following commands.
In addition, I will be using `matrix.example.com` as the server hostname.  
1. Create a new directory for the bridge.  
    ```
    mkdir signal-matrix-bridge
    cd signal-matrix-bridge
    ```  
2. Use your preferred text editor to create a file named `docker-compose.yml` with the following contents. Most of this configuration is taken from the [Mautrix guide](https://docs.mau.fi/bridges/general/docker-setup.html?search=&bridge=signal#docker-compose) and as detailed, ideally, the bridge and Synapse should be on the same network. As this is just a simple server that I'm not using for mission-critical purposes, I'm not too concerned about this. I've left the comments in the file for reference.
    ```
    version: "3.7"

    services:
    mautrix-signal:
        container_name: mautrix-signal
        image: dock.mau.dev/mautrix/signal:latest
        restart: unless-stopped
        volumes:
            - .:/data
        # If you put the service above in the same docker-compose as the homeserver,
        # ignore the parts below. Otherwise, see below for configuring networking.

        # If synapse is running outside of docker, you'll need to expose the port.
        # Note that in most cases you should either run everything inside docker
        # or everything outside docker, rather than mixing docker things with
        # non-docker things.
        ports:
            - "29328:29328"
        # You'll also probably want this so the bridge can reach Synapse directly
        # using something like `http://host.docker.internal:8008` as the address:
        extra_hosts:
            - "host.docker.internal:host-gateway"

        # If synapse is in a different network, then add this container to that network.
        #networks:
        #- synapsenet
    # This is also a part of the networks thing above
    #networks:
    #  synapsenet:
    #    external:
    #      name: synapsenet
    ```
3. Now, run the container with auto-remove to generate the configuration files.  
    ```
        docker run --rm -v `pwd`:/data:z dock.mau.dev/mautrix/signal:latest
    ```
4. Edit the file so the first couple lines under `homeserver` look similar to the following. Whilst I haven't tested it (as stated before, just wanted to get this up and running), I believe that the `address` could be `http://host.docker.internal:8008` or the IP/hostname of the Synapse server running locally.  
    ```
    homeserver:
        # The address that this appservice can use to connect to the homeserver.
        address: https://matrix.example.com
        # The domain of the homeserver (also known as server_name, used for MXIDs, etc).
        domain: matrix.example.com
    ```
5. Under `appservices`, edit the file so it looks similar to the following. Whilst probably not the best practice, I had my machine's local IP address as the `address`.  Also, this isn't the entirety of the `appservices`, just the relevant parts.  
    ```
    appservice:
        # The address that the homeserver can use to connect to this appservice.
        address: http:///host.docker.internal:29328
        
        # The hostname and port where this appservice should listen.
        hostname: 0.0.0.0
        port: 29328
        
        # Database config.
        database:
            # The database type. "sqlite3-fk-wal" and "postgres" are supported.
            type: "sqlite3-fk-wal"
            # The database URI.
            #   SQLite: A raw file path is supported, but `file:<path>?_txlock=immediate` is recommended.
            #           https://github.com/mattn/go-sqlite3#connection-string
            #   Postgres: Connection string. For example, postgres://user:password@host/database?sslmode=disable
            #             To connect via Unix socket, use something like postgres:///dbname?host=/var/run/postgresql
            uri: file:/data/db.db?_txlock=immediate
    ```  
6. I also configured permissions to allow myself to use the bridge from `matrix.org`. 
    ```
    permissions:
        "*": relay
        "matrix.example.com": user
        "@<user>:matrix.example.com": admin
        "@<user>:matrix.org": admin
    ```  
7. Other things I enabled in the configuration file were `bridge.double_puppet_allow_discovery`, `encryption.allow` and `encryption.default`.  
    a. As this is YAML, `x.y` would be found under `x` with the field name `y`.  
8. Run same command as in step 3 to generate the appservices file.  
    ```
    docker run --rm -v `pwd`:/data:z dock.mau.dev/mautrix/signal:latest
    ```  
9. Now, a file named `registration.yaml` should be in the directory. Move this file to `appservices/` in the Synapse directory (or check your Matrix server's documentation for where to put this file). If `appservices/` doesn't exist, create it. I would also suggest renaming it something more descriptive, such as `mautrix-signal-registration.yaml`.
    ```
    mv registration.yaml /path/to/synapse/appservices/mautrix-signal-registration.yaml
    ```  
10. In the Synapse directory, edit the `homeserver.yaml` file. Under `app_service_config_files`, add the path to the registration file. If running in Docker, it should look similar to the following.
    ```
    app_service_config_files:
            - /data/appservices/mautrix-signal-registration.yaml    
    ```
11. Now, back in `signal-matrix-bridge/`, run the following command to start the container.  
    ```
    docker-compose up -d
    ```
12. If everything went well, you should be able to see the bridge in the Synapse admin interface. Message `@signalbot:matrix.example.com` to login.  

## Viability  
As I've stressed multiple times, this is a simple bridge. It's not the most secure, nor is it the most efficient. However, it's a good starting point. I've been using it for a few weeks now and it's been working well. I've been able to send messages from Signal to Matrix and vice versa. One of the best features of this bridge is that **it allows you to access Signal from any device with a Matrix client**. Thus, you can **access it through a web browser or a terminal** - something that isn't possible with the official Signal client. In addition, if you have multiple phones, you can use the same Signal account on both.  
I don't recommend using this bridge for anything mission-critical. I was able to setup this bridge in a nearly identical manner and it works. However, I recommend looking through the documentation and doing some research before setting up a bridge for anything important.  