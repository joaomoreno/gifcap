#!/bin/bash
set -e
git submodule update --init --recursive
docker build -t gifcap-encoder -f encoder/Dockerfile .
docker run --rm -v "$(pwd):/work" -w /work gifcap-encoder