# NodeExpressRemixTemplate

## ENV Vars

For litestream, need:

```
LITESTREAM_SECRET_ACCESS_KEY
LITESTREAM_ACCESS_KEY_ID
LITESTREAM_S3_URL=s3://...
```

Tailscale you need

```
TS_AUTHKEY
TS_HOSTNAME
```

`TS_AUTHKEY` needs to be replaced every 90 days unfortunately. You also probably want to revoke a device before deploying so you don't get overlap since there is a grace period before it cleans up the device.
