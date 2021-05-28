FROM emscripten/emsdk
RUN apt update && apt install -y autoconf
ENTRYPOINT ["bash", "-c", "cd encoder && ./configure && make"]

# docker run -it --rm -v $(pwd):/src -u $(id -u):$(id -g) gifcap_builder bash -c './configure && make'