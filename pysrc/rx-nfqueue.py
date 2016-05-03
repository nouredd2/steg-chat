#!/usr/bin/python 

import sys
import socket
import nfqueue
from scapy.all import * 

count = 0

def do_packet_steg(packet):
	# get scapy compatible string
	pkt = IP(packet.get_data())
	global count

	# start packet modification here 
	print pkt.summary()
	count = count + 1


	if  (count % 5 != 0):
		packet.set_verdict(nfqueue.NF_ACCEPT)
	else:
		if pkt.haslayer(UDP) and pkt.haslayer(Raw):
			print "Got RTP packet"
			udp_pkt = pkt.getlayer(UDP)
			udp_pkt.decode_payload_as(RTP)
			rtp_pkt = pkt.getlayer(RTP)

			if rtp_pkt.payload_type == 120L:
				# ok so now we need to set to padding bit and 
				# add the extra byte. I need to worry about 
				# the udp checksum so that it can work here!
				print "here we go"
				rtp_pkt.padding = 1
				rtp_pkt.load = rtp_pkt.load + '\x06'

				del pkt.chksum
				del udp_pkt.chksum
				pkt.len = pkt.len + 1
				udp_pkt.len = udp_pkt.len + 1
				pkt = pkt.__class__(str(pkt))

				print rtp_pkt.show2()
		# accept the packet to send it out after the
		# modification takes place 
		packet.set_verdict_modified(nfqueue.NF_ACCEPT, str(pkt), len(pkt))
	

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
