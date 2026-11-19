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
2. Switch both consoles from beta to Official release channel.
3. Remove double NAT (bridge mode / DMZ on Vodafone and OGERO routers).
4. UPS for Verdun UDM + Linksys switch.
5. Doha Vodafone packet loss still ongoing 17 Nov → restart ONT/router, check fibre/WAN cable, report to Vodafone.

## Sanity check 19 Nov 2026 (16:20 UTC)
- Doha: all 4 APs restarted together ~13:27 UTC after admin logins; Entrance + Ali AP came back at **100 Mbps** links (were 1 Gbps). UDM port 3 errors rising again (4.93 M → 5.25 M).
- Doha 6 GHz auto-picked ch 37 on JR, Master Bedroom and Ali AP (co-channel). Proposed fix: manual 160 MHz → JR 5, Master 37, Entrance 69, Ali 101 (awaiting approval).
- Doha packet loss stopped after the internet reconnected ~04:30 UTC 19 Nov. Speed test 826 / 997 Mbps.
- Verdun healthy; one short WAN drop and a power cut on 18 Nov.
