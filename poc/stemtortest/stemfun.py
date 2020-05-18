import re
import stem
import time

from stem.control import Controller

PK = "MIICXQIBAAKBgQDFRfCYWk/w9bbxsrHkvVZUlwHc+FPXDRXytjGoT7e3VYUE+IbEO+Cr8VQe7P3UsC3T3sgDE39oKwKUoHizIb9b/yV7GvTv2B4QwgbF2oqYa3yPEG4Ytbd/32MTBFaOGfNVgy1/nOpYTGELBfHfElNi4uiWDeRNabFrzKpzLmGF1wIDAQABAoGAYohiedZyI2q3a9XTYOrpGesq9RHb3ogctFQoTWcz3hCLFkaEGbPGrlslpyS8S+WLnk2iHVc5xe/lpBLa9q4eg5ZPZgIdqwTS1UzY0jmX9z/2n1FyQk46gfEQ7e01TCsMu+bc3FFjMiItM1ggtMnB6T4X+WKeFdk8lpMSbv/e6ZECQQDk38REm7i8RZaW4RRZRJvgdWSE8Vki275HNQc3G2R4m71s2ebxXgKdZNJtrKw6PzBI5nRkSna0tHYF4tmd2lDDAkEA3KdgJEqQ8rnZyS9t8n+uLlrOMtIKudh8YqYVs5Xm+vGXFt43ISSLEmv3PECnzjguKNGh0nXAMFzboINrT6IlXQJBANYaCaVQsvjUdDHCbmGvj83io1zF1WeJfq9oCM7hPhShRAter+6czf9kwIC+ZgK697VKeBkVm4QhyMJq2r4S6zcCQDUhCAE1AxmurkXG6c5N9/6pVqTd9j8xZSHLo8YN/gPGT/7tmpCcX/AblvgnCUCaPmMNts0aFSCP+0H24svV2vECQQDbCO6XOANKKOyi9OtqRF7n2D4GU9CLEsX5TW37awLyu1QzuH2QETSvtxchF5rGNcBv0wBmzSuahXpc8cbldjo1"

def main():
	with Controller.from_port() as controller:
		controller.authenticate()
		print("Tor is running version %s" % controller.get_version())

		while True:
			command = raw_input("cli:>")
			process_command(command, controller)



def create_ephemeral_services(numberOfServices, controller):
	services = []
	for i in range(int(numberOfServices)):
		print "Creating hidden service..."
		start_time = time.time()
		s = controller.create_ephemeral_hidden_service(ports={80: '127.0.0.1:4003'}, await_publication=True)
		elapsed = time.time() - start_time
		print str(i) + ". Service " + s.service_id + ".onion created. Time elapsed: " + str(elapsed)
		services.append(s)

	return services


def create_ephemeral_services_quick(numberOfServices, controller):
	services = []
	for i in range(int(numberOfServices)):
		print "Creating hidden service..."
		start_time = time.time()
		s = controller.create_ephemeral_hidden_service(ports={80: '127.0.0.1:4003'})
		elapsed = time.time() - start_time
		print str(i) + ". Service " + s.service_id + ".onion created. Time elapsed: " + str(elapsed)
		services.append(s)

	return services

def create_ephemeral_service_existing(controller):
	s = controller.create_ephemeral_hidden_service(ports={80: '127.0.0.1:4003'}, key_type="RSA1024", key_content=PK)
	print s.service_id





def process_command(command, controller):
    args =re.split(" +", command)

    if args[0] == "hello":
        print "Hello buddy"

    elif args[0] == "make":

    	services = create_ephemeral_services(args[1], controller)
    	for i in services:
    		print i.service_id + ".onion"

    elif args[0] == "makeq":
    	services = create_ephemeral_services_quick(args[1], controller)
    	for i in services:
    		print i.service_id + ".onion"

    elif args[0] == "makex":
    	create_ephemeral_service_existing(controller)

    else:
        print "wrong command!"

if __name__ == "__main__":
    main()


