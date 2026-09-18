# Jeffrey Bowen: website SEO and Google Business Profile launch

The local website is prepared for https://jeffreybowen.com. No DNS, live hosting, Google account, or external profile was changed.

## What was implemented

- Dedicated Chelsea seller guide at /sell-chelsea.html, linked from the home page and navigation.
- Clear seller, buyer and investor consultation routes.
- Static titles, descriptions, canonical URLs, social metadata and structured data across all three pages.
- A Person entity for Jeffrey and a RealEstateAgent business entity; no invented coordinates, office hours, review ratings or sales statistics.
- A sitemap and crawlable website resources. Google needs access to the JSON and scripts used to render the page.
- Shared mobile-friendly styles, keyboard skip links and expandable seller questions.
- Removed unverified testimonial summaries and changing numerical claims; linked to source reviews instead.
- Listing snapshot dates and clearer stale-data wording. This is NOT a live MLS feed.
- Google profile/review buttons that remain hidden until configured.
- Booking controls that remain hidden until a Jeffrey-owned Calendly link is configured.
- Form validation and truthful email-draft fallback. Optional Formspree delivery counts generate_lead only after a successful response; failures keep the entered information.
- No submitted personal details are intentionally included in custom analytics events.

## One configuration file

Edit site-config.json, then run `npm run build` and `npm run check`. Commit/deploy all changed generated files together. No secrets belong in configuration: it is public.

| Field | What to enter |
|---|---|
| siteUrl | Already https://jeffreybowen.com; use the final preferred HTTPS origin |
| googleBusinessProfileUrl | The exact existing, verified Google Maps/Business Profile share link |
| googleReviewUrl | The review link copied from Jeffrey's profile management screen |
| bookingUrl | Jeffrey-owned https://calendly.com/... event link; this widget supports Calendly only |
| formspreeEndpoint | Optional https://formspree.io/f/... endpoint verified to deliver to Jeffrey |
| gaMeasurementId | His G-... Google Analytics measurement ID, after privacy/consent settings are reviewed |
| searchConsoleVerification | Optional URL-prefix property's HTML verification token; DNS verification is preferable for a domain property |
| publicOfficeAddress | Only a confirmed public business address matching visible information; currently deliberately omitted |
| contactEmail | Existing business email; confirm that Jeffrey monitors it |

When a profile URL is added, the build includes it in business structured data and the visible Google links become available. This connects identities; it does not create or verify a Google profile and does not guarantee ranking or a rich result. Omitting an unverified street address means Google's LocalBusiness rich-result requirements may not be met; accurate information is preferable to a fabricated address.

## Google Business Profile: account setup

1. Search Google Maps for Jeffrey Bowen and the business before creating anything. Ask Jeffrey which profile he controls. Claim/recover the existing eligible profile rather than making a duplicate.
2. Jeffrey should retain ownership and invite you as a manager through People and access. Use your own Google account.
3. Confirm eligibility as an individual public-facing real estate practitioner. Follow Google's rules for practitioners sharing offices and for displaying or hiding an address. Do not add a virtual office, fake storefront, or separate profile for each service area. Resolve the conflicting public office addresses with Jeffrey before using one.
4. Use the real-world business/practitioner name under Google's practitioner naming rules, not a list of keywords. Select the most accurate available primary category, such as Real estate agent if applicable. Add genuine services and actual business hours.
5. Complete Google's offered verification process. Verification methods vary; the website cannot bypass it.
6. Once the replacement site is live, set the profile's website link to:
   https://jeffreybowen.com/?utm_source=google&utm_medium=organic&utm_campaign=business_profile
7. Copy the profile's Maps share link into googleBusinessProfileUrl. Copy its review-request link into googleReviewUrl. Rebuild and deploy.
8. Add current authorized photographs, check contact details, and link an appointment option only when it genuinely works.
9. Request honest reviews from actual clients without incentives or filtering out dissatisfied clients. Respond without revealing private transaction information.
10. Review profile performance, actual inquiries, and appointment outcomes monthly. An embedded map or schema alone is not a ranking strategy.

A map embed is intentionally not added until the exact eligible location is confirmed. Direct profile links work without API keys or loading a third-party map on every visit. A live review widget is also not required; no review stars or review counts are fabricated.

## Domain migration: do this before changing DNS

Jeffreybowen.com already leads to another site. Treat this as a migration, not a brand-new domain launch.

1. Confirm ownership of the registrar, DNS, current host and Search Console. Save current DNS records, redirects, website backup and analytics baseline.
2. Export existing indexed and linked URLs from Search Console and the current sitemap. Identify whether the domain simply redirects to ChelseaRealEstate.com or hosts pages of its own. This has not been verified by this local change.
3. Map important old URLs to relevant replacement pages. Keep valuable articles or migrate them. Do not redirect every old page to the homepage or delete the old site blindly.
4. Confirm final hostname: HTTPS non-www is configured. Arrange host-level permanent redirects from HTTP/www and /index.html to the preferred equivalents, preserving query strings. Configure other path redirects on the actual host after it is known.
5. Preview behind authentication or with a staging-only noindex response. Do not let a temporary public preview compete in search. Production metadata is intentionally indexable.
6. Upload the site to the new host and test HTTPS, forms, mobile navigation, property status and bookings before the domain switch. No hosting provider is assumed here.
7. Change only the necessary web records. Preserve MX, SPF, DKIM and DMARC so business email continues working. Have a rollback plan.
8. After launch, verify the canonical URLs, redirects, 404 behavior and live sitemap. Submit https://jeffreybowen.com/sitemap.xml in Search Console and inspect the home and seller URLs.
9. Check Search Console indexing, old-URL errors, traffic and inquiries after the switch. Update the Business Profile website URL only when the site works.

## Search Console and measurement

- Add jeffreybowen.com as a domain property and verify the DNS TXT record, or use the configured HTML token for a URL-prefix property. Keep verification after launch.
- Submit the sitemap. Request indexing of the home and seller pages. Do not promise immediate inclusion or rankings.
- Configure GA4 only after reviewing the real operating privacy/consent requirements. No analytics currently loads because the ID is blank.
- Mark generate_lead and booking_complete as key events once tested. A form's successful provider acceptance still does not prove the agent read it: verify actual inbox delivery separately.
- call_click, email_click, email_draft_open, listing_click and google_profile_click are interest signals, not confirmed customers or conversations.
- The GBP UTM labels appear in website attribution and accompany configured form submissions. Do not put names, email addresses, property-owner information or other personal data into tracking URLs.
- Reconcile online inquiries with CRM appointments, signed clients and closings every month.

## First month after launch

Week 1: test the full inquiry journey, finalize Google profile connections, submit sitemap, check redirects.
Week 2: interview Jeffrey and publish one approved Chelsea seller case study with documented outcomes and permitted photos.
Week 3: use Search Console and client questions to improve the seller guide; make one substantive building/area guide only where Jeffrey can provide specific information.
Week 4: report relevant inquiries, booked and attended appointments, channel attribution and outstanding follow-ups. Choose the next improvement from evidence.

## Content and integration items still needing confirmation

- Current affiliation, licensing details, business email, service scope and final content approval.
- Public office address, eligible Google profile and hours. No unverified map location is published.
- Photo/video permissions, any testimonial permissions and listing accuracy.
- Listing refresh process: existing JSON is a saved Zillow snapshot. Prefer an authorized brokerage/MLS feed or reviewed manual process; this work does not authorize scraping or bypassing access restrictions.
- Correct YouTube channel and current booking account. Existing YouTube configuration was not independently verified here.
- Form delivery: select a provider, configure recipient and anti-spam controls, then send a test with permission and confirm inbox receipt. Until then the form explicitly prepares an email draft.
- Review the privacy text against actual vendor settings, retention and consent practices before launch.

## Official references

- Google business/practitioner rules: https://support.google.com/business/answer/3038177
- Google local ranking: https://support.google.com/business/answer/7091
- LocalBusiness structured data: https://developers.google.com/search/docs/appearance/structured-data/local-business
- Self-serving review snippets: https://developers.google.com/search/blog/2019/09/making-review-rich-results-more-helpful
- Massachusetts broker identification in advertising: https://www.mass.gov/info-details/faqs-about-escrow-accounts-advertising-business-entities-and-other-issues
