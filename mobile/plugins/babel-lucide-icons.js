// lucide-react-native'den adla alınan simgeleri kendi dosyalarından içe aktarır:
//   import { Check, X } from "lucide-react-native"
//   → import Check from "lucide-react-native/icons/check"; import X from "lucide-react-native/icons/x";
// Metro ağaç sallama yapmadığından paket kökünden içe aktarmak 4000'den fazla simgenin hepsini
// pakete koyuyordu (~1,9 MB). Dosyası bulunamayan ad (takma ad, tür) olduğu gibi bırakılır.
const fs = require("fs");
const path = require("path");

// Ad → dosya eşlemesi paketin kendi dışa aktarma listesinden çıkarılır (takma adlar dahil: Trash2 → trash)
let names = null;
function table() {
  if (names) return names;
  names = new Map();
  try {
    const root = path.join(path.dirname(require.resolve("lucide-react-native")), "..", "esm");
    const index = fs.readFileSync(path.join(root, "lucide-react-native.mjs"), "utf8");
    for (const m of index.matchAll(/export\s*\{([^}]*)\}\s*from\s*'\.\/icons\/([^']+)\.mjs'/g)) {
      for (const part of m[1].split(",")) {
        const mm = /default\s+as\s+(\w+)/.exec(part.trim());
        if (mm) names.set(mm[1], m[2]);
      }
    }
  } catch {
    // Bulunamazsa dönüşüm yapılmaz (paket kökünden içe aktarılır)
  }
  return names;
}

function fileFor(name) {
  return table().get(name) ?? null;
}

module.exports = function lucideIcons({ types: t }) {
  return {
    name: "lucide-icons-per-file",
    visitor: {
      ImportDeclaration(p) {
        const node = p.node;
        if (node.source.value !== "lucide-react-native" || node.importKind === "type") return;
        const keep = [];
        const added = [];
        for (const s of node.specifiers) {
          if (s.type !== "ImportSpecifier" || s.importKind === "type") {
            keep.push(s);
            continue;
          }
          const imported = s.imported.name ?? s.imported.value;
          const file = fileFor(imported);
          if (!file) {
            keep.push(s);
            continue;
          }
          added.push(t.importDeclaration([t.importDefaultSpecifier(t.identifier(s.local.name))], t.stringLiteral(`lucide-react-native/icons/${file}`)));
        }
        if (!added.length) return;
        if (keep.length) {
          node.specifiers = keep;
          p.insertAfter(added);
        } else {
          p.replaceWithMultiple(added);
        }
      },
    },
  };
};
