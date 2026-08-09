# MongoDB Atlas setup for ANNS

The storefront uses an Azure Static Web Apps API in `api/`. Database credentials are server-only and must never use a `VITE_` prefix or be committed to Git.

## 1. Atlas configuration

1. Create a database user with read/write access to the ANNS database.
2. Copy the Node.js `mongodb+srv://...` connection string from Atlas.
3. In Atlas Network Access, allow the outbound addresses used by the Azure Static Web App API. Use broad access only temporarily while diagnosing connectivity.

## 2. Azure Static Web Apps settings

In the Azure portal, open the ANNS Static Web App and add these environment variables under **Configuration**:

- `MONGODB_URI`: the complete Atlas connection string.
- `MONGODB_DB_NAME`: `anns` (or the chosen database name).
- `ADMIN_API_KEY`: a long random admin secret. This becomes the password entered on `/product-manager` in production.

Save the settings and redeploy the application. The workflow is configured with `api_location: "api"`.

## 3. Local development

Copy `api/local.settings.example.json` to `api/local.settings.json` and replace the placeholders. The real file is ignored by Git.

Run the frontend and API together with the Azure Static Web Apps CLI:

```sh
npm run build
swa start dist --api-location api
```

Open `http://localhost:4280`.

## 4. Seed the existing catalog

With `MONGODB_URI` and `MONGODB_DB_NAME` available in the environment:

```sh
cd api
npm run seed
```

The seed is idempotent: it upserts products by product ID. The API also creates unique indexes for product, customer, and order IDs.

## 5. Connection check

After deployment, open:

```text
https://annsonline.shop/api/health
```

A successful response is:

```json
{"ok":true,"database":"anns"}
```

The admin dashboard will then show **Atlas connected** instead of **Local mode**.
