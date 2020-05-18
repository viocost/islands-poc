#!/bin/bash
echo updating sources...
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
&& apt install apt-transport-https -y
&& curl -sL https://deb.nodesource.com/setup_9.x | bash -
&& apt install -y nodejs
&& echo Node.JS installed successfully
&& echo installing TOR...
&& apt install tor -y

# Setting tor control password:
&& phash=$(tor --hash-password 'TheP@$sw0rd' | grep 16\:.*)
&& echo 'ControlPort 9051' |  tee -a /etc/tor/torrc
&& echo 'HashedControlPassword' $phash | tee -a /etc/tor/torrc
&& echo ' /etc/tor/torrc' | tee -a /etc/tor/torrc

# starting tor
&& service tor start

&& mkdir /data/islandsData/history -p
