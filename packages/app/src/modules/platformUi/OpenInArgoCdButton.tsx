import Button from '@material-ui/core/Button';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';

// An outlined action that opens another tool in a new tab, like the cards'
// other actions. Renders nothing without a URL.
export const ExternalLinkButton = ({ url, children }: { url: string | null | undefined; children: string }) =>
  url ? (
    <Button
      size="small"
      color="primary"
      variant="outlined"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      endIcon={<OpenInNewIcon fontSize="small" />}
    >
      {children}
    </Button>
  ) : null;

// The one "Open in Argo CD" link on the platform's cards (Deployments, the
// Database page and its schema card). Nothing when no Application was found
// or no Argo CD UI is configured.
export const OpenInArgoCdButton = ({ url }: { url: string | null }) => (
  <ExternalLinkButton url={url}>Open in Argo CD</ExternalLinkButton>
);
