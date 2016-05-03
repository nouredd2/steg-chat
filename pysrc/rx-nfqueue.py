#!/usr/bin/python 

import sys
import socket
import nfqueue
from scapy.all import * 

def do_packet_steg(packet):
	# get scapy compatible string
	pkt = IP(packet.get_data())


	# start packet modification here 
	print pkt.summary()

	if pkt.haslayer(UDP) and pkt.haslayer(Raw):
		udp_pkt = pkt.getlayer(UDP)
		udp_pkt.decode_payload_as(RTP)
		rtp_pkt = pkt.getlayer(RTP)

		if (rtp_pkt.payload_type == 120L) and (rtp_pkt.padding == 1L):
			print "Found possible candidate"
			data = rtp_pkt.load
			print hexdump(data[len(data)-1])


	# accept the packet to send it out after the
	# modification takes place 
	packet.set_verdict(nfqueue.NF_ACCEPT)
	

def main(argv=None):
	print "MIM started listening for packets...."

	q = nfqueue.queue()
	q.open()
	q.bind(socket.AF_INET)
	q.set_callback(do_packet_steg)
	q.create_queue(1)


	try:
		q.try_run()
	except KeyboardInterrupt:
		print "MIM Exiting..."
	
	q.unbind(socket.AF_INET)
	q.close()

if __name__ == "__main__":
	sys.exit(main())
