# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure(2) do |config|

	config.vm.box = "ubuntu/trusty64"
	config.vm.network "private_network", ip: "192.168.33.90"


	config.vm.provider "virtualbox" do |vb|
		vb.cpus = "4"
		vb.memory = "8192"
	end



	config.vm.provision "shell", inline: <<-SHELL

		#------------------------- VERSIONS ---------------------------------------------------
		NODE_VERSION="v0.12.7"


		#------------------------- GENERAL ----------------------------------------------------
		sudo apt-get update
		apt-get install -y build-essential python wget zlib1g-dev libssl-dev libreadline6-dev libyaml-dev git unzip


		#------------------------- Ruby -------------------------------------------------------
		sudo apt-add-repository ppa:brightbox/ruby-ng
		sudo apt-get update
		sudo apt-get install -y ruby2.4


		#------------------------- Capistrano -------------------------------------------------
		sudo gem install capistrano -v 3.7.2


		#------------------------- Imagemagick ------------------------------------------------
		#requirements
		sudo apt-get install pngnq

		#pngout
		cd /opt
		wget http://static.jonof.id.au/dl/kenutils/pngout-20150319-linux.tar.gz
		tar xvfz pngout-20150319-linux.tar.gz
		cd pngout-20150319-linux/x86_64/
		cp pngout /usr/bin

		#main
		sudo apt-get install -y imagemagick


		#------------------------- Pandoc -----------------------------------------------------
		cd /opt/
		wget https://github.com/jgm/pandoc/releases/download/1.15.2/pandoc-1.15.2-1-amd64.deb
		ar p pandoc-1.15.2-1-amd64.deb data.tar.gz | sudo tar xvz --strip-components 2 -C /usr/local


		#------------------------- Prince XML ------------------------------------------------
		#requirements
		sudo aptitude install -y gdebi

		echo ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true | sudo debconf-set-selections
		sudo apt-get install -y ttf-mscorefonts-installer

		cd
		wget https://www.princexml.com/download/prince_11.3-1_ubuntu14.04_amd64.deb
		sudo gdebi -n prince_11.3-1_ubuntu14.04_amd64.deb

		#------------------------- OpenSSL ----------------------------------------------------
		#openssl
		sudo apt-get install -y openssl
		sudo apt-get install -y libssl-dev


		#------------------------- Skapa secretSettings ---------------------------------------
		#$ cd settings
		#make decrypt_conf


		#------------------------- NodeJS -----------------------------------------------------
		#https://nodesource.com/blog/nodejs-v012-iojs-and-the-nodesource-linux-repositories
		curl -sL https://deb.nodesource.com/setup_0.12 | sudo bash -
		sudo apt-get install -y nodejs


		#------------------------- NGINX ------------------------------------------------------
		sudo apt-get install -y nginx
		mv /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak
		cp /vagrant/nginx-dev.conf /etc/nginx/nginx.conf


		#------------------------- NPM --------------------------------------------------------
		sudo npm install -g pm2@2.3.0
		sudo npm install -g uglifyjs@2.4.10 #needed to be able to build the sh in /build
		sudo npm install -g node-inspector@0.12.8
		sudo npm install -g clean-css-cli@4.1.6


	SHELL



	config.vm.provision "shell", run:"always", privileged:false, inline: <<-SHELL
		sudo cp /vagrant/nginx-dev.conf /etc/nginx/nginx.conf
		sudo service nginx restart
		cd /vagrant/servers
		pm2 start pm2_development.json

	SHELL

end
