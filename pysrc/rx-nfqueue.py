#!/usr/bin/python 

import sys
import socket
import nfqueue
from scapy.all import * 

received_bytes = 0

def do_packet_steg(packet):
	# get scapy compatible string
	pkt = IP(packet.get_data())

	global received_bytes

	# start packet modification here 
	if pkt.haslayer(UDP) and pkt.haslayer(Raw):
		udp_pkt = pkt.getlayer(UDP)
		udp_pkt.decode_payload_as(RTP)
		rtp_pkt = pkt.getlayer(RTP)

		if (rtp_pkt.payload_type == 120L): # and (rtp_pkt.padding == 1L):
			data = rtp_pkt.load

			rtp_pkt.load = data[0:len(data)-1]

			received_bytes = received_bytes + 1
			if (received_bytes % 1000 == 0):
				print "Received ", received_bytes, " bytes..."


			udp_pkt.len = udp_pkt.len - 1
			pkt.len = pkt.len - 1
			del pkt.chksum
			del udp_pkt.chksum
			pkt = pkt.__class__(str(pkt))
			packet.set_verdict_modified(nfqueue.NF_ACCEPT, str(pkt), len(pkt))
		else:
			packet.set_verdict(nfqueue.NF_ACCEPT)
	else:
		# accept the packet to send it out after the
		# modification takes place 
		packet.set_verdict(nfqueue.NF_ACCEPT)
	

def main(argv=None):
	print "MIM started listening for packets...."

	q = nfqueue.queue()
	q.open()
	q.bind(socket.AF_INET)
	q.set_callback(do_packet_steg)
	q.create_queue(2)


	try:
		q.try_run()
	except KeyboardInterrupt:
		print "MIM Exiting..."
	
	q.unbind(socket.AF_INET)
	q.close()

if __name__ == "__main__":
	sys.exit(main())
