#
# Makefile
# kostia, 2018-10-26 23:51
#

all:
	python3 setup.py py2app -A --paclages="PyQt5"

clean:
	rm -rf build dist

	
build:
	if [ -f setup.py ]; then
		python3 setup.py py2app
	else
		echo "setup.py not found. Run \"make\" first"
	fi

# vim:ft=make
#
