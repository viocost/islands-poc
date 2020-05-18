FROM ubuntu:xenial


RUN echo updating sources...
    && if !  ((grep -rnw '/etc/apt/sources.list' -e 'deb' -q 'tor' /etc/apt/source.list )) ;  then
            echo 'deb https://deb.torproject.org/torproject.org xenial main' | tee -a /etc/apt/sources.list
            echo 'deb-src https://deb.torproject.org/torproject.org xenial main' | tee -a /etc/apt/sources.list
            gpg --keyserver keys.gnupg.net --recv A3C4F0F979CAA22CDBA8F512EE8CBC9E886DDD89
            gpg --export A3C4F0F979CAA22CDBA8F512EE8CBC9E886DDD89 | apt-key add -
       fi
    && apt update
    && echo installing curl...
    && apt install curl -y
    && echo installing Node.JS...
RUN apt install apt-transport-https -y
    && curl -sL https://deb.nodesource.com/setup_10.x | bash -
    && apt install -y nodejs
    && echo Node.JS installed successfully
    && echo installing TOR...
    && apt install tor -y

    # Setting tor control password:
    && phash=$(tor --hash-password 'TheP@$sw0rd' | grep 16\:.*)
    && echo 'ControlPort 9051' |  /etc/tor/torrc
    && echo 'HashedControlPassword' $phash | /etc/tor/torrc
    && echo ' /etc/tor/torrc' | /etc/tor/torrc

    # starting tor
    && mkdir /data/islandsData/history -p

#Create app directory
WORKDIR /usr/src/app
COPY chat/public/js/sjcl.js ./node_modules/sjcl
COPY config/config.json ./data/islandsData/
COPY chat/package*.json ./
RUN npm install
COPY chat/. .
EXPOSE 4000
CMD ["node", "/usr/src/app/app.js", "-c /data/islandsData/config.json"]

