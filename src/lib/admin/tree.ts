/** Pure manager-hierarchy builder for the Organization Chart. Cycle-safe. */
export type TreeInput = { id: string; name: string; role: string; managerId: string | null; department?: string | null };
export type TreeNode = TreeInput & { reports: TreeNode[] };

export function buildTree(people: TreeInput[]): TreeNode[] {
  const byId = new Map<string, TreeNode>(people.map((p) => [p.id, { ...p, reports: [] }]));
  const roots: TreeNode[] = [];

  // A node is a root if it has no manager in this set, or following its
  // manager chain loops back on itself (data corruption must not hang the page).
  const inCycle = (start: TreeNode): boolean => {
    const seen = new Set<string>([start.id]);
    let cur = start.managerId ? byId.get(start.managerId) : undefined;
    while (cur) {
      if (seen.has(cur.id)) return true;
      seen.add(cur.id);
      cur = cur.managerId ? byId.get(cur.managerId) : undefined;
    }
    return false;
  };

  for (const node of byId.values()) {
    const parent = node.managerId ? byId.get(node.managerId) : undefined;
    if (!parent || inCycle(node)) roots.push(node);
    else parent.reports.push(node);
  }
  const sort = (n: TreeNode[]) => { n.sort((a, b) => a.name.localeCompare(b.name)); n.forEach((x) => sort(x.reports)); };
  sort(roots);
  return roots;
}

export function countNodes(nodes: TreeNode[]): number {
  return nodes.reduce((s, n) => s + 1 + countNodes(n.reports), 0);
}
