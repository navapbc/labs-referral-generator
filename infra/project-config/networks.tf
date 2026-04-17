locals {
  network_configs = {
    dev = {
      account_name = "referral-pilot"

      domain_config = {
        manage_dns = true
        # Placeholder value for the hosted zone
        # A hosted zone represents a domain and all of its subdomains. For example, a
        # hosted zone of foo.domain.com includes foo.domain.com, bar.foo.domain.com, etc.
        hosted_zone = "referral-pilot-dev.navateam.com"

        certificate_configs = {
          "referral-pilot-dev.navateam.com" = {
            source = "issued"
          }
          "app.referral-pilot-dev.navateam.com" = {
            source = "issued"
          }

          # Example certificate configuration for a certificate that is issued elsewhere and imported into the project
          # (currently not supported, will be supported via https://github.com/navapbc/template-infra/issues/559)
          # "platform-test-dev.navateam.com" = {
          #   source = "imported"
          #   private_key_ssm_name = "/certificates/sub.domain.com/private-key"
          #   certificate_body_ssm_name = "/certificates/sub.domain.com/certificate-body"
          # }
        }
      }
    }

    staging = {
      account_name = "staging"

      domain_config = {
        manage_dns  = true
        hosted_zone = "hosted.zone.for.staging.network.com"

        certificate_configs = {}
      }
    }

    prod = {
      account_name = "referral-pilot"

      domain_config = {
        manage_dns  = true
        hosted_zone = "referrals.navateam.com"

        certificate_configs = {
          "referrals.navateam.com" = {
            source = "issued"
          }
          "api.referrals.navateam.com" = {
            source = "issued"
          }

        }
      }
    }
  }
}
