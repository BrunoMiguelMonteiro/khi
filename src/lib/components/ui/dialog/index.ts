import Action from "./dialog-action.svelte";
import Close from "./dialog-close.svelte";
import Content from "./dialog-content.svelte";
import Description from "./dialog-description.svelte";
import Footer from "./dialog-footer.svelte";
import Overlay from "./dialog-overlay.svelte";
import Portal from "./dialog-portal.svelte";
import Title from "./dialog-title.svelte";
import Trigger from "./dialog-trigger.svelte";
import Root from "./dialog.svelte";

export type { DialogActionVariant } from "./dialog-classes";

export {
  Root,
  Title,
  Portal,
  Footer,
  Trigger,
  Overlay,
  Content,
  Description,
  Close,
  Action,
  //
  Root as Dialog,
  Title as DialogTitle,
  Portal as DialogPortal,
  Footer as DialogFooter,
  Trigger as DialogTrigger,
  Overlay as DialogOverlay,
  Content as DialogContent,
  Description as DialogDescription,
  Close as DialogClose,
  Action as DialogAction,
};
