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
	print pkt[UDP].chksum

	if pkt.haslayer(UDP) and pkt.haslayer(Raw):
		print "Got RTP packet"
		pkt.decode_payload_as(RTP)
		rtp_pkt = pkt.getlayer(RTP)

		# ok so now we need to set to padding bit and 
		# add the extra byte. I need to worry about 
		# the udp checksum so that it can work here!
		rtp_pkt.padding = 1
		rtp_pkt.load = rtp_pkt.load + 'a'
		
	pkt.decode_payload_as(UDP)
	print pkt.len
	print pkt.chksum
	print pkt[UDP].len
	print pkt[UDP].chksum
	del pkt.chksum
	del pkt[UDP].chksum
	pkt[UDP].len = pkt[UDP].len + 1
	pkt.len = pkt.len + 1
	pkt = pkt.__class__(str(pkt))
	print pkt.len
	print pkt.chksum
	print pkt[UDP].len
	print pkt[UDP].chksum

	print pkt.show2()
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
