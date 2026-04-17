locals {
  # Map from environment variable name to environment variable value
  # This is a map rather than a list so that variables can be easily
  # overridden per environment using terraform's `merge` function
  default_extra_environment_variables = {
    ENVIRONMENT = var.environment
    # This is useful for development; keep as true until the Hayhook pipelines are stable
    HAYHOOKS_SHOW_TRACEBACKS = "true"
    # Don't send telemetry to Haystack
    HAYSTACK_TELEMETRY_ENABLED = "False"
    # Where Haystack will connect to Phoenix
    # TODO: Move Phoenix (used for both dev and prod) to a URL without "dev"
    PHOENIX_COLLECTOR_ENDPOINT = "https://phoenix.referral-pilot-dev.navateam.com:6006"
    # The project where OTEL data will be stored in Phoenix
    PHOENIX_PROJECT_NAME = "pilot-${var.environment}"
    # Example environment variables
    # WORKER_THREADS_COUNT    = 4
    # LOG_LEVEL               = "info"
    # DB_CONNECTION_POOL_SIZE = 5
    REDACT_PII = "False"

    # Domain name is `null` in preview environments, so explicitly set it to the DEV environment domain
    SENDER_EMAIL = "no-reply@${coalesce(var.domain_name, "referral-pilot-dev.navateam.com")}"
  }

  # Configuration for secrets
  # List of configurations for defining environment variables that pull from SSM parameter
  # store. Configurations are of the format
  # {
  #   ENV_VAR_NAME = {
  #     manage_method     = "generated" # or "manual" for a secret that was created and stored in SSM manually
  #     secret_store_name = "/ssm/param/name"
  #   }
  # }
  secrets = {
    PHOENIX_API_KEY = {
      manage_method     = "manual"
      secret_store_name = "/${var.app_name}-${var.environment}/phoenix-api-key"
    }
    OPENAI_API_KEY = {
      manage_method     = "manual"
      secret_store_name = "/${var.app_name}-${var.environment}/openai-api-key"
    }

    # Example generated secret
    # RANDOM_SECRET = {
    #   manage_method     = "generated"
    #   secret_store_name = "/${var.app_name}-${var.environment}/random-secret"
    # }

    # Example secret that references a manually created secret
    # SECRET_SAUCE = {
    #   manage_method     = "manual"
    #   secret_store_name = "/${var.app_name}-${var.environment}/secret-sauce"
    # }
  }
}
