FROM emscripten/emsdk
RUN apt update && apt install -y autoconf
ENTRYPOINT ["bash", "-c", "cd encoder && ./configure && make"]