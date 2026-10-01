# Name check: "Somebody Did It First"

Checked 2026-10-01 from a cloud container. An egress proxy blocked every direct lookup: YouTube, social sites, RDAP, port-43 whois and USPTO. Only **plain DNS** and **WebSearch** worked. Anything I couldn't check directly is marked "Couldn't check", even when search found nothing.

Proxy evidence: `curl -sS "$HTTPS_PROXY/__agentproxy/status"` logged `connect_rejected — gateway answered 403 to CONNECT` for www.youtube.com, m.youtube.com, www.google.com, dns.google and cloudflare-dns.com.

---

## 1. YouTube handles

| Item | Status | Evidence |
|---|---|---|
| @SomebodyDidItFirst | Couldn't check | `curl -s -o /dev/null -m 15 -w '%{http_code}' https://www.youtube.com/@SomebodyDidItFirst` returned `000` (blocked). `https://m.youtube.com/@SomebodyDidItFirst` returned `000`. WebFetch returned `EGRESS_BLOCKED (www.youtube.com)`. No search hits for a channel with this name: WebSearch `"Somebody Did It First"` restricted to youtube.com found only Ice Spice "Did It First" lyric videos. |
| @SomebodyDidIt1st | Couldn't check | `curl ... https://www.youtube.com/@SomebodyDidIt1st` returned `000` (blocked). No search hits found. |
| @SomebodyDidItFirstTV | Couldn't check | `curl ... https://www.youtube.com/@SomebodyDidItFirstTV` returned `000` (blocked). No search hits found. |
| @DidItFirst | Couldn't check | `curl ... https://www.youtube.com/@DidItFirst` returned `000` (blocked). WebSearch `"@DidItFirst"` found no channel. But "Did It First" is a 2024 Ice Spice and Central Cee hit, and many uploads and fan or lyric channels use the phrase, so this short handle is quite likely taken or at least crowded. |

## 2. Domains

DNS was the only lookup that worked. When a domain **resolves**, it is registered. **NXDOMAIN** (the name doesn't resolve) only suggests the domain is free. It does not prove it, because a registered domain with no nameservers also returns NXDOMAIN.

| Item | Status | Evidence |
|---|---|---|
| somebodydiditfirst.com | Likely available (unverified) | `python3 -c "import socket; print(socket.gethostbyname('somebodydiditfirst.com'))"` returned `gaierror [Errno -2] Name or service not known` (NXDOMAIN). `www.` also NXDOMAIN. RDAP `https://rdap.verisign.com/com/v1/domain/somebodydiditfirst.com` returned `000` from curl and `EGRESS_BLOCKED` from WebFetch. `https://rdap.org/domain/somebodydiditfirst.com` returned `000`. No search hits found. |
| somebodydiditfirst.net | Likely available (unverified) | DNS: NXDOMAIN. `https://rdap.verisign.com/net/v1/domain/somebodydiditfirst.net` returned `000`. |
| somebodydiditfirst.co | Likely available (unverified) | DNS: NXDOMAIN. `https://rdap.nic.co/domain/somebodydiditfirst.co` returned `000`. `whois.nic.co` would not resolve from the container. |
| somebodydiditfirst.tv | Likely available (unverified) | DNS: NXDOMAIN. `https://rdap.nic.tv/domain/somebodydiditfirst.tv` returned `000`. |
| diditfirst.com | **Taken** | `socket.gethostbyname('diditfirst.com')` returned `46.226.10.77`, and `www.diditfirst.com` returned the same IP. It resolves, so it is registered. The IP looks like registrar or parking hosting; I couldn't verify whether it is for sale. `https://rdap.verisign.com/com/v1/domain/diditfirst.com` returned `000`. |
| *(extra)* whodiditfirst.com | Taken | DNS returned `216.40.34.41`. |
| *(extra)* somebodydidit1st.com, diditfirst.net | Likely available (unverified) | DNS: NXDOMAIN. |

Raw whois on port 43 also failed. `python3 -c "import socket; socket.create_connection(('whois.verisign-grs.com',43),timeout=10)"` returned `OSError [Errno 97] Address family not supported by protocol` (same for whois.nic.tv). The `whois`, `dig`, `nslookup` and `host` binaries are not installed. DNS-over-HTTPS (dns.google, cloudflare-dns.com) returned `000` (connect_rejected).

## 3. Social handles (`somebodydiditfirst`)

| Item | Status | Evidence |
|---|---|---|
| Instagram | Couldn't check | `curl ... https://www.instagram.com/somebodydiditfirst/` returned `000`. Site-restricted WebSearch (instagram.com, tiktok.com): no search hits found for the account. |
| TikTok | Couldn't check | `curl ... https://www.tiktok.com/@somebodydiditfirst` returned `000`. WebFetch returned `EGRESS_BLOCKED (www.tiktok.com)`. Site-restricted search found only "did it first" song or meme tag pages, with no search hits for the account. |
| X / Twitter | Couldn't check | `curl ... https://x.com/somebodydiditfirst` returned `000`. Site-restricted search (x.com, twitter.com, facebook.com) found two unrelated posts and no search hits for the account. |
| Facebook | Couldn't check | `curl ... https://www.facebook.com/somebodydiditfirst` returned `000`. No search hits found. |
| Threads | Couldn't check | `curl ... https://www.threads.net/@somebodydiditfirst` returned `000`. WebSearch refused the domain: `threads.net not accessible to our user agent`. |
| Reddit r/SomebodyDidItFirst | Couldn't check | `curl ... https://www.reddit.com/r/SomebodyDidItFirst/about.json` returned `000`. WebFetch said it was "unable to fetch from www.reddit.com". WebSearch refused the domain: `reddit.com not accessible`. |

## 4. USPTO trademarks (Class 41 entertainment and video, Class 25 apparel)

| Item | Status | Evidence |
|---|---|---|
| "SOMEBODY DID IT FIRST" (41 / 25) | Couldn't check | `curl ... https://tmsearch.uspto.gov` returned `000`. `https://tsdr.uspto.gov` returned `000`. WebSearch `"Somebody Did It First" trademark` found only general trademark-law articles. No search hits found for a filing. |
| "DID IT FIRST" (41 / 25) | Couldn't check | WebSearch `"Did It First" trademark` restricted to trademarkia.com, justia.com and uspto.gov found nothing relevant; the only near-match was "DADDY DID IT FISH HOUSE". No search hits found. Note that the Ice Spice song title makes a filing by her label or a merch seller plausible. |
| "WHO DID IT FIRST" (41) | Couldn't check | WebSearch found no trademark record, but a podcast with this name exists (see below). |

---

## Lookalikes / existing uses of the phrase

I found **no existing show, channel, podcast, book or brand using the exact phrase "Somebody Did It First"**. The nearby uses:

- **"Did It First"**, Ice Spice and Central Cee (2024 single). It dominates search results for the phrase. https://en.wikipedia.org/wiki/Did_It_First and https://www.rollingstone.com/music/music-news/ice-spice-central-cee-did-it-first-video-1235058734/
- **"Who Did It First?"**, a comedy podcast (Outpost Media) about the origins of things. It overlaps closely if the channel is about "firsts". https://podcasts.apple.com/us/podcast/who-did-it-first/id1528438747
- **"I Did It First"**, a comedy podcast. https://podcasts.apple.com/us/podcast/i-did-it-first/id1805632900
- **"Who Did It First? 50 Icons, Luminaries, and Legends Who Revolutionized the World"**, a book. https://mitpressbookstore.mit.edu/book/9781250263193
- **"Who Did It First?"**, Bob Leszczak's book series on cover songs. https://www.goodreads.com/book/show/18670711-who-did-it-first
- **"Somebody Had to Do It First"**, a Shirley Chisholm phrase used in article titles. https://ibw21.org/editors-choice/somebody-had-to-do-it-first-the-story-of-shirley-chisholm/
- **"Somebody's Gotta Do It"**, Mike Rowe's TV show (CNN/TBN). It sounds similar but is distinct. https://en.wikipedia.org/wiki/Somebody's_Gotta_Do_It
- **"Did It First"** by Dax (music video). https://www.youtube.com/watch?v=SYLrgDNPcX0
- Domains **diditfirst.com** and **whodiditfirst.com** both resolve, so both are registered.

---

## What the user should run on their Mac

Paste this into Terminal (about 2 minutes). For whois, "No match", "NOT FOUND" or "Domain not found" means the domain is available. For curl, `200` means the handle is taken and `404` usually means it is free. Instagram, X, Facebook and Threads often return 200 or 302 even for missing accounts, so open those in a browser too.

```bash
# Domains
for d in somebodydiditfirst.com somebodydiditfirst.net somebodydiditfirst.co somebodydiditfirst.tv diditfirst.com somebodydidit1st.com; do
  echo "== $d"; whois $d | grep -iE "no match|not found|domain name:|registrar:|creation date" | head -4
done

# Handles (status code)
for u in \
  https://www.youtube.com/@SomebodyDidItFirst \
  https://www.youtube.com/@SomebodyDidIt1st \
  https://www.youtube.com/@SomebodyDidItFirstTV \
  https://www.youtube.com/@DidItFirst \
  https://www.tiktok.com/@somebodydiditfirst \
  https://www.instagram.com/somebodydiditfirst/ \
  https://x.com/somebodydiditfirst \
  https://www.facebook.com/somebodydiditfirst \
  https://www.threads.net/@somebodydiditfirst \
  https://www.reddit.com/r/SomebodyDidItFirst/; do
  printf "%s  " "$(curl -s -o /dev/null -L -A 'Mozilla/5.0' -w '%{http_code}' "$u")"; echo "$u"
done

# Trademark: open and search "SOMEBODY DID IT FIRST" and "DID IT FIRST" (check Classes 41 and 25)
open "https://tmsearch.uspto.gov/search/search-information"
```

Fastest single check for the YouTube handle: on youtube.com go to **Create a channel → Handle** and type `SomebodyDidItFirst`. YouTube shows availability live.

---

**Provisional verdict (direct checks were blocked; confirm with the commands above):** Use with a tweak. The exact phrase "Somebody Did It First" shows no existing channel, show, book or trademark in search, and somebodydiditfirst.com does not resolve (likely free). Skip the short **@DidItFirst** handle and **diditfirst.com**: the domain is already registered and the phrase belongs to the Ice Spice song. **Best handle: @SomebodyDidItFirst** if it's open; fallback **@SomebodyDidItFirstTV** (clearer than "1st" and easier to say aloud). Also check that the content angle doesn't overlap the existing "Who Did It First?" podcast.
