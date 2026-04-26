CREATE TABLE "public_keys" (
    "node"          CHAR(66)        NOT NULL,
    "agentLabel"    TEXT            NOT NULL,
    "publicKey"     BYTEA           NOT NULL,
    "pubKeyHash"    CHAR(66)        NOT NULL,
    "registeredAt"  TIMESTAMPTZ(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMPTZ(3)  NOT NULL,

    CONSTRAINT "public_keys_pkey" PRIMARY KEY ("node")
);
