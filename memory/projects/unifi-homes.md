# UniFi Homes (Nov 2026)

**Status:** Tuning done 17 Nov 2026; physical follow-ups open.

## Access
- UniFi Site Manager API key saved as a network secret for `api.ui.com` (header `X-API-KEY`) in the Claude cloud "Default" environment. Must be a key from unifi.ui.com → API (Network-app keys don't work).
- Full Network app API reachable through the cloud connector:
  `https://api.ui.com/v1/connector/consoles/<hostId>/proxy/network/api/s/default/...`
  (read with GET, change with PUT, e.g. `rest/device/<id>` radio_table, `rest/wlanconf/<id>`, `rest/networkconf/<id>`).

## Dashboard
- **UniFi Homes** dashboard: https://claude.ai/artifact/HZU26bgBrYQ6c2ABQDEY81
- Snapshot data (17 Nov 2026), not live. Refresh = rerun the build script and re-upload the JSON files.

## Results after tuning (17 Nov 2026)
- Doha speed test: 863 down / 990 up Mbps (plan 1000/1000).
- Verdun speed test: 312 down / 148 up Mbps (plan 300/95).

## Changes applied (63 total)
- 2.4 GHz → 20 MHz on non-overlapping channels, both homes.
- 5 GHz channels de-overlapped (Doha 80 MHz incl. DFS; Verdun 40 MHz, no DFS).
- Doha 6 GHz 320 → 160 MHz. Uniform min RSSI. Verdun U6 LR 2.4 GHz power → Medium.
- Min data rates raised; Doha RWC fast roaming on; Verdun RWC Guest isolated.
- Doha WAN plan speed 1500 → 1000 Mbps; WAN2 disabled at both homes.

## Open to-dos (manual)
1. Doha UDM port 3: errors not increasing (checked 17 Nov afternoon) → only replace cable if the count grows.
3. Remove double NAT (bridge mode / DMZ on Vodafone and OGERO routers).
4. Verdun UPS: postponed until summer 2027 (user's decision).
5. Doha Vodafone packet loss still ongoing 17 Nov → restart ONT/router, check fibre/WAN cable, report to Vodafone.

## Sanity check 19 Nov 2026 (16:20 UTC)
- Doha: all 4 APs restarted together ~13:27 UTC after admin logins; Entrance + Ali AP came back at **100 Mbps** links (were 1 Gbps). UDM port 3 errors rising again (4.93 M → 5.25 M).
- Doha 6 GHz auto channels overlapped (JR+Ali on 37, Entrance+Master in 65-93). Qatar allows only 6 GHz ch 1-93 (three 160 MHz blocks), so set **80 MHz fixed**: JR 5, Ali 21, Master 37, Entrance 69 (applied 19 Nov). All 4 AP links back at 1 Gbps by 16:40 UTC.
- Doha packet loss stopped after the internet reconnected ~04:30 UTC 19 Nov. Speed test 826 / 997 Mbps.
- Verdun healthy; one short WAN drop and a power cut on 18 Nov.

## Health check 21 Nov 2026 (04:00 UTC)
- Doha: all APs on 1 Gbps links, all channels as planned. Port 3 errors stopped (+520 in 36 h vs millions before) → cable fixed. Zero packet loss since 19 Nov morning.
- Doha scheduled speed test fails daily: mode "ALL" also tests disabled WAN2 (eth9) and that failure overwrites the result. Manual test fine (826/997). Verdun has the same "ALL" setting.
- Doha Jr's room weakest: Jr MacMini −72 dBm at ~55 Mbps (still needs cable), Jr PS5 −72 dBm.
- Verdun: healthy; another power cut ~20 Nov (Rooms + Entrance restarted).

## 21 Nov 2026 follow-up
- Doha speed test fixed by user: WAN1 only (wan_list WAN), daily 06:00.
- Doha JR AP: 5/6 GHz power set to High, but live power stayed 18/17 dBm (already at the legal limit for Qatar; no gain). Min RSSI −75 → −80 dBm on JR AP 5/6 GHz.
- Doha RWC network: 5 GHz roaming assistant −75 → −80 dBm, so Jr's devices aren't pushed to 2.4 GHz.

## WhatsApp via VPN (21 Nov 2026, Doha)
- Created traffic routes "WhatsApp via VPN" (Meta AS32934: 34 IPv4 + 2 IPv6 ranges) and "WhatsApp via VPN (domains)", all devices, via **PIA DE**, kill switch off.
- PIA login was fine (PC app works on OpenVPN UDP 8080, AES-128-GCM, RSA-4096). The old PIA files (UDP 1198, AES-128-CBC, RSA-2048) were rejected by UniFi's OpenVPN.
- **Fixed 21 Nov:** PIA DE now uses PIA generator file de_berlin UDP 1197 / RSA-4096 / AES-256-GCM, with `ncp-disable` replaced by `data-ciphers AES-256-GCM:AES-128-GCM` (UniFi's OpenVPN 2.6 rejects ncp-disable). Status CONNECTED. All four Doha PIA clients now on PIA generator UDP 1197 / RSA-4096 / AES-256-GCM files (same ncp-disable fix), all CONNECTED: PIA DE = Berlin (used by WhatsApp routes), PIA FR = France, PIA USA = New York, PIA SG = Singapore (slot formerly PIA QA). If one shows SERVER_REJECT right after a file change, switch it off and on once.
- Old disabled rules (VPN, WhatsApp, Full IP list, New IP List) not deleted: delete was blocked; user to remove manually.
- Phones need WhatsApp → Privacy → Advanced → "Protect IP address in calls" ON so calls go via Meta relays.

## Doha health check 21 Nov 2026 (05:20 UTC)
- All green: 4 APs online on 1 Gbps links, channels as planned, max airtime 28% (Entrance 2.4 GHz, mostly neighbours), zero packet loss for 2+ days, port 3 errors not increasing.
- 4 PIA tunnels CONNECTED, WhatsApp routes active via PIA DE. Router CPU ~23% (VPN encryption), fine.
- Speed test 730 down / 944 up Mbps with household in use (earlier 826/997).
- Jr's room improved after JR AP / roaming changes: Jr Tab S9+ and Jr iPhone 18 Pro now on 5 GHz; 23 of 25 devices at −70 dBm or better.

## Snapchat via VPN (21 Nov 2026, Doha)
- User confirmed WhatsApp calls work via VPN.
- Added "Snapchat via VPN" (AS395291: 104.193.185.0/24, 204.154.248.0/24, 204.154.250.0/24) and "Snapchat via VPN (domains)" (snapchat.com, snap.com, snapkit.com, snap-dev.net, sc-cdn.net, sc-static.net, sc-prod.net, sc-gw.com, sc-jpl.com, sc-corp.net, snapads.com, bitmoji.com, feelinsonice-hrd.appspot.com), all devices, via PIA DE, kill switch off.
- Snapchat mostly runs on Google Cloud/AWS, so the domain rule does most of the work; if calls still fail, next step is adding observed call-server IPs.

## Snapchat calls fix (21 Nov 2026, Doha)
- [stated] User tested Snapchat voice/video calls: they did not go through the VPN.
- Router traffic log (09:23 Doha) showed the call between Ali iPhone 17 and Jr iPhone 18 Pro used Snapchat relay 63.177.140.74 (AWS Frankfurt) and its IPv6 twin 2a05:d014:…, on UDP 3478/19302/443 and TCP 23405, straight over Vodafone. No DNS lookup, so the domain rule could not see it; IPv6 also bypasses PIA (no IPv6 support).
- Added route "Snapchat calls via VPN (call ports)": all public IPv4 blocks (54 entries, private ranges excluded) on ports 3478, 19302, 23405, plus 63.177.140.74 on all ports, via PIA DE. UniFi rejects /1 or wider blocks.
- Turned off IPv6 on the Doha Default LAN (ipv6_interface_type pd → none) so nothing can bypass the VPN over IPv6. Phones drop their IPv6 address after reconnecting to Wi-Fi.
- [stated] 21 Nov 2026: user retested Snapchat calls and confirmed they work. Router log confirms the call media to relay 63.177.140.74 (UDP 443) went via PIA DE; IPv6 traffic from phones tailing off after IPv6 was turned off.

## Zoom / Meet / Teams kept off the VPN (21 Nov 2026)
- [stated] Zoom, Google Meet and Microsoft Teams must stay direct (no VPN), fastest connection.
- The broad Snapchat call-port rule (all public IPv4 on 3478/19302/23405) also caught Teams (3478) and Meet (19302). Narrowed it and renamed it "Snapchat calls via VPN (relays)": AWS EC2 eu-central-1 + eu-west-1 ranges only (136 prefixes, from ip-ranges.amazonaws.com) on ports 3478/19302/23405, plus 63.177.140.74 all ports.
- Checked: no active VPN rule overlaps Microsoft AS8075, Google AS15169/AS396982 or Zoom AS30103, and no VPN domain contains zoom/teams/microsoft/google/meet. Google-network traffic seen via VPN earlier was only Snapchat's own Google Cloud servers (gcp.api.snapchat.com etc.), not Meet.

## Instagram / Facebook kept off the VPN (21 Nov 2026, ~5:20 pm Doha)
- [stated] Instagram on the Mac Mini was slow; Instagram and Facebook browsing must not go through the VPN.
- Cause: "WhatsApp via VPN" covered all of Meta AS32934 on all ports, so Instagram/Facebook went via PIA DE (and were served from Frankfurt CDN). Also the WhatsApp domain rule included whatsapp.com and similar, which share Meta's main edge server (157.240.29.22, star.c10r.facebook.com).
- Fix: renamed the address rule "WhatsApp calls via VPN (Meta call ports)": Meta's 34 IPv4 ranges on UDP/TCP ports 3478, 45395, 50318, 59234 only (IPv6 entries dropped). Domain rule "WhatsApp via VPN (domains)" reduced to whatsapp.net only, then switched off/on to clear learned addresses.
- Verified in the traffic log: Instagram and Facebook now leave via Vodafone; whatsapp.net still via PIA DE.

## VPN audit (21 Nov 2026, ~5:40 pm Doha)
- [stated] The VPN is only for WhatsApp and Snapchat; all other traffic must go direct.
- Audit found ~700 of ~860 VPN connections in 90 min were Instagram/Facebook: **UniFi traffic routes ignore the port list on IP entries**, so "Meta call ports" still routed all Meta traffic, and the Snapchat "AWS EU ranges" rule could catch any site hosted in AWS Frankfurt/Ireland.
- Rebuilt with exact addresses only (no ranges):
  - "WhatsApp servers via VPN (exact addresses)": call relays 157.240.29.62, 31.13.69.62, 157.240.243.62, 31.13.86.48, 57.144.121.54, 57.144.69.54 and WhatsApp servers 157.240.29.60, 157.240.29.61, 157.240.227.60, 157.240.0.60, 57.144.249.32, 57.144.245.32 (none serve Facebook/Instagram in the logs)
  - "Snapchat call relays via VPN (exact addresses)": 63.177.140.74, 3.66.122.104 (left out 74.125.250.129 = Google Meet and Cloudflare 162.159.207.0 / 141.101.90.1)
  - Unchanged: "WhatsApp via VPN (domains)" = whatsapp.net; "Snapchat via VPN (domains)"; "Snapchat via VPN" (Snap AS395291, 3 x /24)
  - Name rules switched off/on to clear learned addresses (an "on" call timed out once; retried, all 5 rules active)
- Re-audit (4 min): 90 VPN connections, 79 WhatsApp + 11 Snapchat, 0 other; Microsoft traffic direct.
- If a WhatsApp or Snapchat call later skips the VPN, a new relay address is in use: find it in the traffic log and add that single address.

## WhatsApp calls failing (21 Nov 2026, ~7:25 pm Doha)
- [stated] WhatsApp voice/video calls from his phone to Ali (inside home) and to Tania did not connect.
- Cause: calls used new relays not in the exact-address list (185.60.217.52, 157.240.17.62, 157.240.203.62, 57.144.223.54, 57.144.249.54) on UDP/TCP 3478 via Vodafone. WhatsApp picks a different relay per call, so exact lists cannot keep up.
- Fix (7:28 pm): rule renamed "WhatsApp servers and call relays via VPN", 4,041 entries following Meta's server numbering: in every /24 of 157.240.0.0/16, 31.13.64.0/18, 31.13.24.0/21, 185.60.216.0/22 the addresses .48, .50-.51, .52-.55, .56-.59, .60-.61, .62 (.49 left out: Facebook used 157.240.29.49); in every /24 of 57.144.0.0/14 the addresses .32 and .54; plus all relays seen so far.
- Checked: none of the 33 Facebook/Instagram addresses seen today is inside the pattern; no overlap with Microsoft/Google/Zoom. Instagram still direct after the change.
- [stated] ~7:30 pm: he retested WhatsApp voice/video calls (to Ali and Tania) after the pattern rule and confirmed they work ("all good").

## Overnight check 22 Nov 2026 (asked after Tania reported interruptions)
- Real Vodafone outages: internet down 2:33 to 2:47 am Doha (14 min, "WAN failed" after packet loss at 2:32) and a short drop at 3:06 am; 4% packet loss around 3:00 am. Otherwise 6 single 1% loss blips over 24 h.
- No equipment problem: UDM up since Wed, all 4 APs up since Thu 19:21, all on 1 Gbps, CPU 1-6% (the 4,041-entry WhatsApp rule causes no load). All 4 PIA tunnels connected. Speed test 06:06 today: 872/955 Mbps.
- Wi-Fi disconnect spike at 2 am matches the outage; Tania's phone shows normal roaming only.

## Roaming fix 22 Nov 2026 (Tania's WhatsApp calls dropping while walking)
- Evidence: Tania S25+ was dropped at 11:21 am on 6 GHz at exactly -75 dBm (the minimum-signal kick level). 5 of 8 6 GHz disconnects in 24 h were at -73 to -80 dBm. Her phone otherwise roams fine (48 roams, 3 drops).
- Change: minimum signal (min RSSI) on 5 and 6 GHz from -75 to **-82 dBm** on Entrance, Master Bedroom and Ali AP. JR AP left at -80 (Jr's room setting). 2.4 GHz stays -78.
- Already on: fast roaming (802.11r), BSS transition (802.11v), WPA3, MLO on RWC.
- Next step if drops continue: turn off MLO on RWC (known to hurt roaming on some phones).
