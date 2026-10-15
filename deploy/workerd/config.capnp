using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [
    (name = "andrea-modpost-api", worker = (
      compatibilityDate = "2026-10-14",
      modules = [
        (name = "worker.js", esModule = embed "worker.js")
      ]
    ))
  ],
  sockets = [
    (name = "http", address = "*:8787", http = (), service = "andrea-modpost-api")
  ]
);
