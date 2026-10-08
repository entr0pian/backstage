import Button from '@material-ui/core/Button';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';

// The one "Open in Argo CD" link on the platform's cards (Deployments, the
// Database page and its schema card): an outlined button like the cards' other
// actions, opening Argo CD in a new tab. Renders nothing without a URL (no
// Application found, or no Argo CD UI configured).
export const OpenInArgoCdButton = ({ url }: { url: string | null }) =>
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
      Open in Argo CD
    </Button>
  ) : null;
