FROM ubuntu:xenial

RUN echo updating sources... \
    && apt update \
    && echo installing curl... \
    && apt install curl -y \
    && echo installing Node.JS... \
    && apt install apt-transport-https -y \
    && echo 'deb https://deb.torproject.org/torproject.org xenial main' | tee -a /etc/apt/sources.list \
    && echo 'deb-src https://deb.torproject.org/torproject.org xenial main' | tee -a /etc/apt/sources.list \
    && gpg --keyserver keys.gnupg.net --recv A3C4F0F979CAA22CDBA8F512EE8CBC9E886DDD89 \
    && gpg --export A3C4F0F979CAA22CDBA8F512EE8CBC9E886DDD89 | apt-key add - \
    && apt update \
    && apt install netcat -y \
    && apt install nano -y \
    && apt install vim -y \
    #\
    && curl -sL https://deb.nodesource.com/setup_10.x | bash - \
    && apt install -y nodejs \
    && echo Node.JS installed successfully \
    && echo installing TOR... \
    && apt install tor -y

    # Setting tor control password:
RUN phash=$(tor --hash-password 'TheP@$sw0rd' | grep 16\:.*) \
    && echo 'ControlPort 9051' | tee -a /etc/tor/torrc \
    && echo 'HashedControlPassword' $phash | tee -a /etc/tor/torrc \
    && echo 'ExitPolicy reject *:*' | tee -a /etc/tor/torrc

    # starting tor


#Create app directory
WORKDIR /usr/src/app

COPY . .
RUN npm install
EXPOSE 4000
EXPOSE 80
EXPOSE 9229
STOPSIGNAL SIGTERM

CMD sleep 2 && \
    service tor start && \
    /bin/bash