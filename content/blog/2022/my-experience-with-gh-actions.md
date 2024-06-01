---
title: My experience with Github Actions
date: 2022-10-07
summary: I started using Github Actions a couple months ago. While I'm not a power user of Github Actions, I still find it to be powerful.  
draft: false
# tags: ["github", "software"]
params:
    description: I've started using Github Actions. This is my experience with it, and how I setup a Go CI workflow 
---
I started using Github Actions a couple months ago. While I'm not a power user of Github Actions, I still find it to be powerful.  
### What is Github Actions?  
Github Actions is a service that allows you to run code when certain events happen. For example, you can run code when a pull request is opened, when a commit is pushed, or when a release is published.It allows for continuous integration and continuous deployment, but also management of pull requests, issues, and more.  
## My use cases  
I've been using Github Actions to automatically deploy my website. I use Hugo to generate my website, and I use Github Pages to host it. I also use it to automatically build and release my Go programs.
### Continuous deployment  
Before I started learning Go, I used Python. When I started using Go, I liked being able to compile my code. I learned of cross compilation, and started using xgo to cross compile my code. However, at that time, I was running xgo locally and manually uploading the binaries to Github and publishing the release. After publishing two releases with this strategy, I decided to automate the process. I decided to start using Github Actions. I discovered an [xgo step](https://github.com/crazy-max/ghaction-xgo) which I could use in my workflow. I found an action for nightly releases, but unfortunately realized that is was intended to update the files associated with a release, not re-release with the updated files.  
After some research I found [softprops/action-gh-release](https://github.com/softprops/action-gh-release) worked for my use case. However, at that time, a new tag was created with the short commit tag for every new release. I kept using this for a while, before eventually realizing how many tags and releases were being created. I started trying to find a way to delete the old release and tag before creating a new one. I found [EndBug/latest-tag](github.com/EndBug/latest-tag) and [Archaholic/action-delete-release](github.com/Archaholic/action-delete-release). I used these two actions to delete the old release and tag before re-releasing.  
At the time of writing, I use this method. However, I recently found [dev-drprasad/delete-tag-and-release](https://github.com/dev-drprasad/delete-tag-and-release), which I may switch to.  
#### Example workflow:  
```yml
name: Continuous Integration 

on:
  push:
    branches:
      - master
jobs:
  build-and-release:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Cross compile
      uses: crazy-max/ghaction-xgo@v2
      with:
        xgo_version: latest
        go_version: 1.19
        dest: /home/runner/work/repo-name/builds
        prefix: prefix
    - name: Compress releases
      run: zip -r /home/runner/work/repo-name/binaries.zip /home/runner/work/repo-name/builds/*
    - name: Delete old release
      uses: Archaholic/action-delete-release@v1
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN  }}
      with:
        tag_name: rolling
    - name: Update tag
      uses: EndBug/latest-tag@latest
      with:
        ref: rolling
    - name: Release
      uses: softprops/action-gh-release@v1
      with:
        name: Rolling release
        prerelease: true
        tag_name: rolling
        body: "Latest commit: ${{ github.event.head_commit.message }}"
        files: |
          /home/runner/work/repo-name/binaries.zip 
          /home/runner/work/repo-name/builds/*
    - name:
      uses: actions/upload-artifact@v3
      with:
        name: binaries
        path: /home/runner/work/repo-name/builds/*

```