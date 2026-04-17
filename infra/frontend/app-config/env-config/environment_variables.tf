locals {
  # Map from environment variable name to environment variable value
  # This is a map rather than a list so that variables can be easily
  # overridden per environment using terraform's `merge` function
  default_extra_environment_variables = {
    ENVIRONMENT = var.environment
    # Base URL of the backend API used by the Next.js frontend.
    # Override per environment via service_override_extra_environment_variables
    # in infra/frontend/app-config/<env>.tf. Left empty by default so that
    # misconfigured deployments fail fast in getApiDomain().
    NEXT_PUBLIC_API_BASE_URL = ""
    # Example environment variables
    # WORKER_THREADS_COUNT    = 4
    # LOG_LEVEL               = "info"
    # DB_CONNECTION_POOL_SIZE = 5
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
