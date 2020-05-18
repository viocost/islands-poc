FROM ubuntu:xenial

RUN echo updating sources... 
RUN apt update 
RUN echo installing curl... 
RUN apt install build-essential -y
RUN apt install curl -yq 
RUN echo installing Node.JS... 
RUN apt install apt-transport-https -yq 
RUN echo 'deb https://deb.torproject.org/torproject.org xenial main' | tee -a /etc/apt/sources.list 
RUN echo 'deb-src https://deb.torproject.org/torproject.org xenial main' | tee -a /etc/apt/sources.list 
RUN curl https://deb.torproject.org/torproject.org/A3C4F0F979CAA22CDBA8F512EE8CBC9E886DDD89.asc | gpg --import 
RUN gpg --no-tty --export A3C4F0F979CAA22CDBA8F512EE8CBC9E886DDD89 | apt-key add - 
RUN apt update -yq
RUN curl -sL https://deb.nodesource.com/setup_10.x | bash - 
RUN apt install -yq nodejs 
RUN echo Node.JS installed successfully 
RUN echo installing TOR... 
RUN apt install tor deb.torproject.org-keyring -yq
# Setting tor control password:
RUN phash=$(tor --hash-password 'TheP@$sw0rd' | grep 16\:.*)  &&\
    echo 'ControlPort 9051' | tee -a /etc/tor/torrc  &&\
    echo 'HashedControlPassword' $phash | tee -a /etc/tor/torrc &&\
    echo 'ExitPolicy reject *:*' | tee -a /etc/tor/torrc 
    # starting tor
RUN mkdir /data/islandsData/history -p 

#Create app directory
WORKDIR /usr/src/app
COPY server/config/config.json ./data/islandsData/
COPY package*.json ./
RUN npm install 
#&& npm install -g forever\
RUN npm install -g pm2 
RUN pm2 update 
RUN apt install unzip -y
COPY . .
EXPOSE 4000
EXPOSE 80
EXPOSE 9229
STOPSIGNAL SIGTERM

CMD sed -i -e 's/\r$//' /usr/src/app/server/scripts/updategh.sh 
CMD sed -i -e 's/\r$//' /usr/src/app/server/scripts/update.sh 

CMD service tor start &&\
    pm2 start /usr/src/app/server/app.js --node-args="--inspect=0.0.0.0:9229 --experimental-worker" -- -c /usr/src/app/server/config/config.json  &&\
    pm2 attach 0 &&\
    /bin/bash
#CMD ["node", "/usr/src/app/app.js", "-c /data/islandsData/config.json"]


