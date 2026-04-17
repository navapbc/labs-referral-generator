import logging

import boto3
import markdown
from botocore.exceptions import ClientError

from src.app_config import config

logger = logging.getLogger(__name__)


def send_email(recipient: str, subject: str, body: str) -> bool:
    """
    Send an email using AWS SES.

    Args:
        recipient: Email address of the recipient
        subject: Email subject line
        body: Plain text email body

    Returns:
        True if email was sent successfully, False otherwise
    """
    ses_client = boto3.client("sesv2", region_name=config.aws_ses_region)

    logger.debug("Preparing to send email to %s with subject '%s'", recipient, subject)

    try:
        response = ses_client.send_email(
            FromEmailAddress=config.aws_ses_from_email,
            Destination={"ToAddresses": [recipient]},
            Content={
                "Simple": {
                    "Subject": {"Data": subject, "Charset": "UTF-8"},
                    "Body": {
                        "Html": {"Data": markdown.markdown(body), "Charset": "UTF-8"},
                        "Text": {"Data": body, "Charset": "UTF-8"},
                    },
                }
            },
        )
        message_id = response["MessageId"]
        logger.info("Email sent successfully to %s. MessageId: %s", recipient, message_id)
        return True

    except ClientError as e:
        logger.error("Failed to send email to %s: %s", recipient, e.response["Error"]["Message"])
        return False
    except Exception as e:
        logger.error("Unexpected error sending email to %s: %s", recipient, str(e))
        return False
