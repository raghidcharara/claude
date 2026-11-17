# Home networks

## Doha 🇶🇦 (Qatar)
- ISP: Vodafone Qatar, plan **1 Gbps down / 1 Gbps up**. UDM WAN on port 9 (1 GbE) behind the Vodafone router.
- Gateway: UDM Pro, LAN 192.168.0.0/24. IPS, ad blocking and family DNS filter on.
- Access points (WiFi 7, all wired via an unmanaged switch on UDM **port 3**):
  | AP | Model | 2.4 GHz | 5 GHz | 6 GHz |
  |----|-------|---------|-------|-------|
  | Entrance | U7 Pro | ch 1 / 20 | ch 36 / 80 | auto / 160 |
  | JR AP | U7 Pro Wall | ch 11 / 20 | ch 52 / 80 | auto / 160 |
  | Master Bedroom | U7 Pro Wall | ch 1 / 20 | ch 149 / 80 | auto / 160 |
  | Ali AP | U7 Pro | ch 6 / 20 | ch 100 / 80 (DFS; radar moved it to 132/40 once) | auto / 160 |
- Min RSSI: −78 dBm (2.4), −75 dBm (5/6). Min data rate 12 Mbps (RWC, JR), 6 Mbps (IOT). Fast roaming on.
- Wi-Fi networks: RWC, JR (WPA3, MLO on, all bands), IOT (2.4 GHz WPA2).
- UDM port 3 shows ~4.9 M receive errors (0.38%), but the count did not grow between 07:30 and 14:30 UTC on 17 Nov 2026 → old errors, monitor only.
- Internet: bursts of packet loss (up to ~30%) on Vodafone line (Oct 26–28, Nov 15–17 2026; still 5–18% in many 5-min windows on 17 Nov afternoon). Latency stays 3 ms. Main open issue.

## Beirut – Verdun 🇱🇧 (Lebanon)
- ISP: OGERO, **300 / 95 Mbps** (maximum OGERO offers). UDM behind OGERO router.
- Gateway: UDM Pro, LAN 192.168.2.0/24 ("DMP Fiber"). Ports: 1 Linksys LGS308P PoE switch, 6 Philips Hue, 7 Office AP.
- Access points (WiFi 6, all wired):
  | AP | Model | 2.4 GHz | 5 GHz |
  |----|-------|---------|-------|
  | Office | U6 Mesh | ch 1 / 20 | ch 36 / 40 |
  | TV Room | U6 Mesh | ch 11 / 20 | ch 44 / 40 |
  | Rooms | U6 LR | ch 6 / 20, power Medium | ch 149 / 40 |
  | Entrance | U6 LR | ch 1 / 20, power Medium | ch 157 / 40 |
- Min RSSI −78 dBm everywhere; min data rate 12 Mbps. DFS off.
- Wi-Fi networks: RWC (WPA2, fast roaming), RWC Guest (guest isolation on).
- Frequent power cuts → UPS recommended.

## Both homes
- Consoles on **beta** release channel (should switch to Official manually).
- WAN2 disabled on both (was unplugged; it broke the built-in speed test).
- Network app 6.0.17 / UniFi OS 6.0.130 (Nov 2026).
