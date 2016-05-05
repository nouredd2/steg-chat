#!/usr/bin/python 

import sys
import socket
import nfqueue
import os
from scapy.all import * 

count = 0
byte_count = 0
f = None
done = False

def do_packet_steg(packet):
	# get scapy compatible string
	pkt = IP(packet.get_data())
	global count
	global byte_count
	global f
	global done

	# start packet modification here 
	# print pkt.summary()
	count = count + 1

	b = f.read(1)
	if b:
		# there is data to send out!
		# if  (count % 5 != 0):
		# 	packet.set_verdict(nfqueue.NF_ACCEPT)
		# else:
		if pkt.haslayer(UDP) and pkt.haslayer(Raw):
			udp_pkt = pkt.getlayer(UDP)
			udp_pkt.decode_payload_as(RTP)
			rtp_pkt = pkt.getlayer(RTP)

			if rtp_pkt.payload_type == 120L:
				# ok so now we need to set to padding bit and 
				# add the extra byte. I need to worry about 
				# the udp checksum so that it can work here!
				#print udp_pkt.show2()
				#print rtp_pkt.show2()
				#rtp_pkt.padding = 0
				#print type(rtp_pkt.load)
				rtp_pkt.load = rtp_pkt.load + b
				#rtp_pkt.load[10] = '\x61'
				pkt.len = pkt.len + 1
				udp_pkt.len = udp_pkt.len + 1
				
				del pkt.chksum
				del udp_pkt.chksum
				pkt = pkt.__class__(str(pkt))

				byte_count = byte_count + 1
				print "Sent", byte_count, " bytes in total..."
			
				# accept the packet to send it out after the
				# modification takes place 
				#print udp_pkt.show2()
				#print rtp_pkt.show2()
				#print pkt.show2()
				packet.set_verdict_modified(nfqueue.NF_ACCEPT, str(pkt), len(pkt))
			else:
				packet.set_verdict_modified(nfqueue.NF_ACCEPT, str(pkt), len(pkt))
	else:
		if done == False:
			print "Transferred ", byte_count, " bytes..."
			done = True
		packet.set_verdict(nfqueue.NF_ACCEPT)
	

def main(argv=None):
	print "MIM started listening for packets...."

	q = nfqueue.queue()
	q.open()
	q.bind(socket.AF_INET)
	q.set_callback(do_packet_steg)
	q.create_queue(1)

	global f 
	f = open("/home/webchat/ToSend.txt", "rb")
	print os.path.getsize("/home/webchat/ToSend.txt")


	try:
		q.try_run()
	except KeyboardInterrupt:
		f.close()
		print "MIM Exiting..."
	
	q.unbind(socket.AF_INET)
	q.close()

if __name__ == "__main__":
	sys.exit(main())
