import requests
import os
import time

token = os.environ.get('APIFY_TOKEN', '')
if not token:
    print("ERROR: APIFY_TOKEN not set")
    exit(1)

payload = {
    'categories': ['sale'],
    'counties': ['dublin', 'cork', 'galway', 'limerick', 'kildare', 'wicklow', 'meath'],
    'priceMin': 200000,
    'maxItems': 500,
    'proxyConfiguration': {
        'useApifyProxy': True,
        'apifyProxyGroups': ['RESIDENTIAL'],
        'apifyProxyCountry': 'IE'
    }
}

r = requests.post(
    'https://api.apify.com/v2/acts/vladignatyev~daft-ie-scraper/runs',
    json=payload,
    params={'token': token}
)

data = r.json()['data']
run_id = data['id']
print('Run ID:', run_id)

for i in range(40):
    time.sleep(10)
    resp = requests.get(
        'https://api.apify.com/v2/actor-runs/' + run_id,
        params={'token': token}
    ).json()['data']
    elapsed = (i + 1) * 10
    status  = resp['status']
    # try different stat keys
    stats = resp.get('stats', {})
    items = stats.get('itemCount', stats.get('outputItems', stats.get('savedItems', '?')))
    print('  [' + str(elapsed) + 's] status=' + status + '  items=' + str(items))
    if status in ('SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'):
        print('Dataset ID:', resp['defaultDatasetId'])
        print('All stats keys:', list(stats.keys()))
        break
