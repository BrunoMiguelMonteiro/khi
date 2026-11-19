import Action from "./alert-dialog-action.svelte";
import Cancel from "./alert-dialog-cancel.svelte";
import Content from "./alert-dialog-content.svelte";
import Description from "./alert-dialog-description.svelte";
import Footer from "./alert-dialog-footer.svelte";
import Overlay from "./alert-dialog-overlay.svelte";
import Portal from "./alert-dialog-portal.svelte";
import Title from "./alert-dialog-title.svelte";
import Trigger from "./alert-dialog-trigger.svelte";
import Root from "./alert-dialog.svelte";

export type { DialogActionVariant } from "../dialog/dialog-classes";

export {
  Root,
  Title,
  Action,
  Cancel,
  Portal,
  Footer,
  Trigger,
  Overlay,
  Content,
  Description,
  //
  Root as AlertDialog,
  Title as AlertDialogTitle,
  Action as AlertDialogAction,
  Cancel as AlertDialogCancel,
  Portal as AlertDialogPortal,
  Footer as AlertDialogFooter,
  Trigger as AlertDialogTrigger,
  Overlay as AlertDialogOverlay,
  Content as AlertDialogContent,
  Description as AlertDialogDescription,
};
