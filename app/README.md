# Architecture

5 Docker containers are required to run the application:
- Frontend for the web UI
- Backend provides API endpoints for the Frontend
- Phoenix for observability, monitoring, and prompt management supporting the backend
- Postgres DB for the backend and Phoenix
- Chroma as the vector DB for RAG

Configuration files:
- `src/app_config.py` - default settings
- `local.env` - non-secret settings; overrides those in `src/app_config.py`
- `override.env` - put API keys and secrets here; overrides those in `local.env`.
  This is ignored by git so personalized settings can go in here.

## Local Setup

1 container for the frontend (in the `frontend` folder) and 4 containers for the backend (in the `app` folder) .

### Frontend

1. `cd frontend`
2. `make dev` starts 1 container
3. browse to http://localhost:3001/generate-referrals
4. To stop the container: `make stop`

### Backend

1. `cd app`

2. `make build` to build the container images using `docker-compose.yml`, which defines 4 containers:
   - `app-db` (Postgres DB)
   - `phoenix`
   - `chromadb`
   - `app` (backend) -- uses the `Dockerfile` to build the image

3. Set configurations in `override.env` based on settings in `local.env` that state `DO_NOT_SET_HERE` (like `OPENAI_API_KEY`).

4. (Optional) See **Populating vector database for RAG** section below.

5. `make start` to start the containers

6. `docker compose ps` to ensure all containers are running. To preview containers:
   a. `app` OpenAPI spec: browse to http://localhost:3000/docs
   a. `phoenix` traces: browse to http://localhost:6006/projects and click on `local-docker-project`.
   a. `chroma` DB records (called "documents" but they're actually chunks of documents): `poetry run chroma browse 'referral_resources_local' --path chroma_data`.
   a. `app-db` Postgres DB: use a DB client with the credentials in `docker-compose.yml`

7. Add prompt templates in Phoenix via `make load-prompts-from-json`.
   View prompts at http://localhost:6006/prompts
   (If prompts in the deployed Phoenix have changed, run `make copy-prompts` to update them locally and commit those changes to git.)

8. Test using API using `curl` commands. For example:
```sh
BASE_URL="http://localhost:3000"
PAYLOAD='{
  "model": "generate_referrals_rag",
  "suffix": "centralpa"

  "user_email": "curl_test@cli.dev",
  "query": "Help with day care services"
}'
echo "Testing streaming generate_referrals_rag endpoints at $BASE_URL"
curl -k -X 'POST' $BASE_URL'/generate_referrals_rag/chat' -H 'accept: application/json' -H 'Content-Type: application/json' -d "$PAYLOAD"

echo "Testing non-streaming generate_referrals_rag/run endpoint"
curl -k -X 'POST' $BASE_URL'/generate_referrals_rag/run' -H 'accept: application/json' -H 'Content-Type: application/json' -d "$PAYLOAD"
```

9. To stop the containers: `make stop`

### Populating vector database for RAG

In the `files_to_ingest_into_vector_db` subfolder, create a subfolder representing a region like `centralpa` or `centraltx`. Within that region subfolder, put files that will be ingested into the vector database (Chroma DB), which is needed for RAG.  These files are ingested by `rag_utils.populate_vector_db()`, which is automatically called in `gunicorn.conf.py` upon app startup. (After startup, repopulating the Chroma DB collection can be manually triggered via `make populate-vector-db`.)

Supported file types include: `md` (Markdown files are preferred), `txt`, `pdf`, `csv`, `json`, ... -- refer to [MultiFileConverter](https://docs.haystack.deepset.ai/docs/multifileconverter).

### Copying prompts from the deployed Phoenix

If prompts in the deployed Phoenix have changed, run `make copy-prompts` to update them locally and commit those changes to git. `make copy-prompts` will copy the prompts in the deployed Phoenix instance into your local Phoenix instance.
   a. To enable it, add the `DEPLOYED_PHOENIX_URL` and `DEPLOYED_PHOENIX_API_KEY` environment variables to `override.env`.
   a. Create a system API key at `$DEPLOYED_PHOENIX_URL/settings/general`.
   a. Then run `make copy-prompts`. This will copy the prompt versions specified in `app_config.py`, which are the ones used in the deployed app.
   a. Remember to do this every time the prompt version is updated in `app_config.py`. When running locally, the latest version of the prompt is used.

### Enabling authentication to log into Phoenix

Based on [documentation](https://arize.com/docs/phoenix/self-hosting/features/authentication), update `docker-compose.yaml` as follows.
* Add these environment variables to the `phoenix` service:
```
      - PHOENIX_ENABLE_AUTH=True
      - PHOENIX_SECRET=TypeSomeLongSecretThatWillBeUsedToSignJWTsForTheDeployment
```
* Restart and log into the Phoenix UI at http://localhost:6006 and create a system API key; copy the API key
* Add PHOENIX_API_KEY environment variable in `override.env` for the Haystack pipelines to authenticate to (sign into) Phoenix:
```
      - PHOENIX_API_KEY=<paste API key>
```

### To enable Phoenix SSL/TLS

Make the following changes, then restart (`make stop` then `make start`).
   a. In `docker-compose.yml`, set `PHOENIX_TLS_ENABLED` to `True`
   b. In `override.env`, set `PHOENIX_COLLECTOR_ENDPOINT` to use `https` and uncomment `PHOENIX_API_KEY`

For details, see the next section.

#### Enabling https for Phoenix

Based on [this documentation](https://arize.com/docs/phoenix/release-notes/04.2025/04.28.2025-tls-support-for-phoenix-server).

1. Get TLS/SSL certificate
   * (For Lightsail instance of Phoenix) Create and download certificate from ACM (AWS Certificate Manager)
      - Enable and copy static IP from Lightsail instance
      - Create A record static IP in Route 53
      - Request certificate in ACM
      - Created CNAME record based on request result for ACM to validate request
      - Upon ACM validation, exported certificate from ACM; download and move to a `certs` folder
      - Append the contents of `certificate_chain.txt` to the end of `certificate.pem`
      - Copy `certs` folder to Lightsail instance: `scp -i $SSH_KEY_PEM_FILE -r certs ec2-user@${STATIC_IP}`
   * (For local dev environment) Create self-signed certificate for Phoenix instance
```sh
# This 'certs' folder will be mounted as a volume in the phoenix Docker container
mkdir certs && cd certs
# Generate root CA's private key
openssl genrsa -out rootCA.key 4096
# Create self-signed root CA certificate
openssl req -x509 -new -nodes -key rootCA.key -sha256 -days 3650 -out rootCA.crt -subj "/C=US/ST=Test/L=Test/O=DevRootCA/OU=IT/CN=DevRootCA"

# Generate a server's private key
openssl genrsa -out server.key 2048
# Create the server's certificate signing request (CSR)
# Important: include ALL possible hostnames in the subjectAltName list
# - "phoenix" for interactions between Docker containers within docker-compose network
# - "localhost" for connecting to Phoenix Docker container from outside the docker-compose network
openssl req -new -key server.key -out server.csr -subj "/C=US/ST=Test/L=Test/O=MyTestServer/OU=IT/CN=phoenix" -addext "subjectAltName = DNS:phoenix,DNS:localhost"
# Sign CSR with the root CA certificate
# Important: use '-copy_extensions copy' to copy over subjectAltName values
openssl x509 -req -in server.csr -CA rootCA.crt -CAkey rootCA.key -CAcreateserial -out server.crt -days 825 -sha256 -copy_extensions copy
# Confirm alternative name
openssl x509 -in server.crt -noout -ext subjectAltName
# and other data
openssl x509 -in server.crt -noout -text
# Verify against root CA
openssl verify -CAfile rootCA.crt server.crt

# Include Root CA in server's cert so that it's available for client-side validation
cat server.crt rootCA.crt > server-fullchain.crt
```

2. Configure SSL in Phoenix by updating `compose.yaml` (locally or in Lightsail instance) with:
```yaml
    environment:
      ...
      - PHOENIX_TLS_ENABLED=True
      - PHOENIX_TLS_CERT_FILE=/certs/server-fullchain.crt
      - PHOENIX_TLS_KEY_FILE=/certs/server.key
      # - PHOENIX_TLS_KEY_FILE_PASSWORD=<insert password used when exporting certs from ACM>
      - PHOENIX_TLS_VERIFY_CLIENT=False
    volumes:
      - ./certs:/certs
```

3. Restart Phoenix

4. Update Phoenix client (i.e., Haystack backend)
   * In `local.env`, set `PHOENIX_COLLECTOR_ENDPOINT` to the secured Phoenix instance (i.e., `https` prefix)
   * (For Lightsail instance of Phoenix) Add Amazon's intermediate CA certificate by ensuring `certs/aws_ca_intermediate_cert` is set to the Amazon intermediate CA certificate.
     (Export the "Amazon RSA 2048 M04" intermediate certificate using a browser pointed at
  the Phoenix instance.)
   * (For local dev environment) Add self-signed root CA certificate as a trusted CA  by ensuring `certs/local_dev_only_selfsigned_ca_root_cert` is set to the self-signed root CA certificate.
     (Use the contents of `rootCA.crt` created in step 1 above.)

5. Restart Phoenix client
