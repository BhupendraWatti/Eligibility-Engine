declare namespace App {
  interface Locals {
    /** Set by middleware for public (non-admin) requests. */
    viewerState?: import('./services/viewer-state').ViewerState;
  }
}
