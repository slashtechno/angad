---
title: My experience with Github Actions
date: 2022-10-07
lastmod: 2024-06-28
# Not setting description here since we're setting the summary anyway
summary: I started using Github Actions a couple months ago. While I'm not a power user of Github Actions, I still find it to be powerful.  
draft: false
tags: ["github"]
---
I started using Github Actions a couple months ago. While I'm not a power user of Github Actions, I still find it to be powerful.  
### What is Github Actions?  
Github Actions is a service that allows you to run code when certain events happen. For example, you can run code when a pull request is opened, when a commit is pushed, or when a release is published.It allows for continuous integration and continuous deployment, but also management of pull requests, issues, and more.  
## My use cases  
I've been using Github Actions to automatically deploy my website. I use Hugo to generate my website, and I use Github Pages to host it. I also use it to automatically build and release my Go programs.
### Continuous deployment  
Before I started learning Go, I used Python. When I started using Go, I liked being able to compile my code. I learned of cross compilation, and started using xgo to cross compile my code. However, at that time, I was running xgo locally and manually uploading the binaries to Github and publishing the release. After publishing two releases with this strategy, I decided to automate the process. I decided to start using Github Actions. I discovered an [xgo step](https://github.com/crazy-max/ghaction-xgo) which I could use in my workflow. I found an action for nightly releases, but unfortunately realized that is was intended to update the files associated with a release, not re-release with the updated files.  
After some research I found [softprops/action-gh-release](https://github.com/softprops/action-gh-release) worked for my use case. However, at that time, a new tag was created with the short commit tag for every new release. I kept using this for a while, before eventually realizing how many tags and releases were being created. I started trying to find a way to delete the old release and tag before creating a new one. I found [EndBug/latest-tag](github.com/EndBug/latest-tag) which let me create a rolling tag.
#### Example workflow:  
The example workflow below is a slightly modified version of the workflow I use to build and release [cross-blogger](https://github.com/slashtechno/cross-blogger) as of June 2024.  
```yml
name: Continuous Integration

on:
  push:
  workflow_dispatch:
    inputs:
      branch:
        description: 'Branch to build and release from'
        required: false
        default: 'main'

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true


jobs:

  build-and-release:
    # Unless the branch is specified, only run on the default branch
    if: github.event_name == 'workflow_dispatch' || github.ref == 'refs/heads/${{ github.event.inputs.branch || github.ref }}'
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Cross compile
      uses: crazy-max/ghaction-xgo@v3
      with:
        xgo_version: latest
        go_version: 1.22
        dest: /home/runner/work/cross-blogger/builds
        prefix: cross-blogger
    - name: Compress releases
      run: zip -r /home/runner/work/cross-blogger/binaries.zip /home/runner/work/cross-blogger/builds/*
    - name: Update tag
      uses: EndBug/latest-tag@latest
      with:
        ref: rolling
    - name: Release
      uses: softprops/action-gh-release@v2
      with:
        name: Rolling release
        prerelease: true
        tag_name: rolling
        body: "Latest commit: ${{ github.event.head_commit.message }}"
        files: |
          /home/runner/work/cross-blogger/binaries.zip 
          /home/runner/work/cross-blogger/builds/*
    - name: Upload Artifact
      uses: actions/upload-artifact@v3
      with:
        name: binaries
        path: /home/runner/work/cross-blogger/builds/*
```