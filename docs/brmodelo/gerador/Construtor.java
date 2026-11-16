import controlador.Controler;
import controlador.Diagrama;
import controlador.Editor;
import desenho.FormaElementar;
import desenho.preAnyDiagrama.PreCardinalidade.TiposCard;
import diagramas.conceitual.Atributo;
import diagramas.conceitual.Entidade;
import diagramas.conceitual.Ligacao;
import diagramas.conceitual.Relacionamento;
import diagramas.logico.Campo;
import diagramas.logico.Constraint;
import diagramas.logico.LogicoLinha;
import diagramas.logico.Tabela;
import java.awt.Point;
import java.awt.image.BufferedImage;
import java.io.File;
import java.util.HashMap;
import java.util.Map;
import javax.imageio.ImageIO;
import javax.swing.SwingUtilities;
import principal.Aplicacao;

/** Monta diagramas do brModelo 3.3.1 usando as classes do próprio programa. */
public abstract class Construtor {

    protected Diagrama d;
    protected final Map<String, Entidade> ents = new HashMap<>();
    protected final Map<String, Relacionamento> rels = new HashMap<>();
    protected final Map<String, Tabela> tabs = new HashMap<>();
    protected final Map<String, Campo> campos = new HashMap<>();

    static final int PASSO_ATRIBUTO = 18;

    protected abstract void conceitual();

    protected abstract void logico();

    public void rode(String pasta) throws Exception {
        Aplicacao.main(new String[0]);
        while (Aplicacao.fmPrincipal == null || !Aplicacao.fmPrincipal.isVisible()) Thread.sleep(200);
        Thread.sleep(1500);
        SwingUtilities.invokeAndWait(() -> {
            try {
                Editor ed = Aplicacao.fmPrincipal.getEditor();
                d = ed.AddAsAtual(Diagrama.TipoDeDiagrama.tpConceitual.name());
                conceitual();
                salve(new File(pasta, "nexo-modelo-conceitual"));

                d = ed.AddAsAtual(Diagrama.TipoDeDiagrama.tpLogico.name());
                logico();
                salve(new File(pasta, "nexo-modelo-logico"));
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
        System.exit(0);
    }

    private void salve(File base) throws Exception {
        // a primeira pintura ajusta a largura dos atributos (autosize); só depois salva e exporta
        Point p = d.getPontoExtremo();
        util.ImageGenerate.geraImagemForPrn(d, p.x + 400, p.y + 200);
        d.Salvar(new File(base.getPath() + ".brM3"), false);
        p = d.getPontoExtremo();
        BufferedImage img = util.ImageGenerate.geraImagemForPrn(d, p.x + 20, p.y + 20);
        ImageIO.write(img, "PNG", new File(base.getPath() + ".png"));
        System.out.println("salvo " + base);
    }

    // ------------------------------------------------------------------ conceitual

    /** Atributos começando com '*' são identificadores. Os atributos ficam à direita da entidade. */
    protected Entidade ent(String nome, int x, int y, int alturaExtra, String... attrs) {
        Entidade e = (Entidade) d.ExternalRealiseComando(Controler.Comandos.cmdEntidade, new Point(x, y));
        e.setTexto(nome);
        int altura = Math.max(58, 16 + attrs.length * PASSO_ATRIBUTO + alturaExtra);
        e.SetBounds(x, y, Math.max(150, nome.length() * 8 + 24), altura);
        e.Reenquadre();
        for (int i = 0; i < attrs.length; i++) {
            atributo(new Point(e.getLeftWidth() - 2, e.getTop() + 12 + i * PASSO_ATRIBUTO), attrs[i]);
        }
        ents.put(nome, e);
        return e;
    }

    protected Relacionamento rel(String nome, int x, int y, String... attrs) {
        Relacionamento r = (Relacionamento) d.ExternalRealiseComando(Controler.Comandos.cmdRelacionamento, new Point(x, y));
        r.setTexto(nome);
        r.Reenquadre();
        int cy = r.getTop() + r.getHeight() / 2;
        for (int i = 0; i < attrs.length; i++) {
            Atributo a = atributo(new Point(r.getLeftWidth() - 12, cy), attrs[i]);
            int desloc = (i - (attrs.length - 1) / 2) * PASSO_ATRIBUTO;
            if (desloc != 0) a.DoMove(0, desloc);
        }
        rels.put(nome, r);
        return r;
    }

    private Atributo atributo(Point clique, String nome) {
        Atributo a = (Atributo) d.ExternalRealiseComando(Controler.Comandos.cmdAtributo, clique);
        boolean id = nome.startsWith("*");
        a.setTexto(id ? nome.substring(1) : nome);
        if (id) a.setIdentificador(true);
        return a;
    }

    /** Ponto na borda: lado T, B, L ou R; frac de 0 a 1 ao longo do lado. */
    static Point borda(FormaElementar f, char lado, double frac) {
        int x = f.getLeft(), y = f.getTop(), w = f.getWidth(), h = f.getHeight();
        switch (lado) {
            case 'T': return new Point(x + (int) (w * frac), y + 2);
            case 'B': return new Point(x + (int) (w * frac), y + h - 2);
            case 'L': return new Point(x + 2, y + (int) (h * frac));
            default: return new Point(x + w - 2, y + (int) (h * frac));
        }
    }

    /** Vértice do losango: T, B, L ou R. */
    static Point vertice(Relacionamento r, char lado) {
        int x = r.getLeft(), y = r.getTop(), w = r.getWidth(), h = r.getHeight();
        switch (lado) {
            case 'T': return new Point(x + w / 2, y + 3);
            case 'B': return new Point(x + w / 2, y + h - 3);
            case 'L': return new Point(x + 4, y + h / 2);
            default: return new Point(x + w - 4, y + h / 2);
        }
    }

    /** Liga entidade ao relacionamento. card: "01", "11", "0n" ou "1n" (cardinalidade escrita junto à entidade). */
    protected void lig(String ent, char ladoEnt, double frac, String rel, char ladoRel, String card) {
        Entidade e = ents.get(ent);
        Relacionamento r = rels.get(rel);
        if (e == null || r == null) throw new IllegalArgumentException("lig " + ent + " " + rel);
        d.ExternalRealiseComando(Controler.Comandos.cmdLinha, borda(e, ladoEnt, frac));
        Ligacao l = (Ligacao) d.ExternalRealiseComando(Controler.Comandos.cmdLinha, vertice(r, ladoRel));
        if (l.getCard() == null) throw new IllegalStateException("sem cardinalidade: " + ent + " - " + rel);
        l.getCard().setCard(card(card));
    }

    static TiposCard card(String c) {
        switch (c) {
            case "01": return TiposCard.C01;
            case "11": return TiposCard.C11;
            case "1n": return TiposCard.C1N;
            default: return TiposCard.C0N;
        }
    }

    // ------------------------------------------------------------------ lógico

    protected Tabela tab(String nome, int x, int y) {
        Tabela t = (Tabela) d.ExternalRealiseComando(Controler.Comandos.cmdTabela, new Point(x, y));
        t.setTexto(nome);
        tabs.put(nome, t);
        return t;
    }

    protected Campo campo(String tabela, String nome, String tipo, boolean pk, boolean uk) {
        Tabela t = tabs.get(tabela);
        Campo c = t.Add(nome);
        c.setTipo(tipo);
        if (pk) c.setKey(true);
        if (uk) {
            c.SetUnique(true);
            c.SetUnique(true, null);
        }
        campos.put(tabela + "." + nome, c);
        return c;
    }

    protected void ajuste(String tabela, int largura) {
        Tabela t = tabs.get(tabela);
        t.Reenquadre();
        t.SetBounds(t.getLeft(), t.getTop(), largura, t.getHeight());
        t.Reenquadre();
    }

    protected void entLargura(String nome, int largura) {
        Entidade e = ents.get(nome);
        e.SetBounds(e.getLeft(), e.getTop(), largura, e.getHeight());
        e.Reenquadre();
    }

    /** Centro vertical da linha do campo dentro da tabela (cabeçalho e linhas de 22 px). */
    static int yCampo(Tabela t, Campo c) {
        return t.getTop() + 22 + 22 * t.getCampos().indexOf(c) + 11;
    }

    /** FK: destino.campoFk referencia origem.campoPk. */
    protected void fk(String origem, String campoPk, String destino, String campoFk, boolean obrigatoria, boolean unica) {
        Tabela ori = tabs.get(origem), dest = tabs.get(destino);
        Campo cmpO = campos.get(origem + "." + campoPk), cmpD = campos.get(destino + "." + campoFk);
        if (ori == null || dest == null || cmpO == null || cmpD == null)
            throw new IllegalArgumentException("fk " + origem + "." + campoPk + " -> " + destino + "." + campoFk);
        Point pO, pD;
        int yO = yCampo(ori, cmpO), yD = yCampo(dest, cmpD);
        if (dest.getLeft() >= ori.getLeftWidth() + 20) {
            pO = new Point(ori.getLeftWidth() - 2, yO); pD = new Point(dest.getLeft() + 2, yD);
        } else if (dest.getLeftWidth() <= ori.getLeft() - 20) {
            pO = new Point(ori.getLeft() + 2, yO); pD = new Point(dest.getLeftWidth() - 2, yD);
        } else if (dest.getTop() > ori.getTopHeight()) {
            pO = new Point(ori.getLeft() + ori.getWidth() / 2, ori.getTopHeight() - 2); pD = new Point(dest.getLeft() + dest.getWidth() / 2, dest.getTop() + 2);
        } else {
            pO = new Point(ori.getLeft() + ori.getWidth() / 2, ori.getTop() + 2); pD = new Point(dest.getLeft() + dest.getWidth() / 2, dest.getTopHeight() - 2);
        }
        // linha em Z com 4 pontos: destino, cotovelo, cotovelo, origem
        LogicoLinha linha = new LogicoLinha(d);
        linha.setInteligente(false);
        linha.SuperInicie(2, pD, pO);
        java.util.List<desenho.linhas.PontoDeLinha> pts = linha.getPontos();
        if (pD.y == pO.y || pD.x == pO.x) {
            pts.get(1).setCentro(pO); pts.get(2).setCentro(pD);
        } else if (Math.abs(pO.x - pD.x) > 60 && (pO.x >= ori.getLeftWidth() - 2 || pO.x <= ori.getLeft() + 2)) {
            int mx = (pO.x + pD.x) / 2;
            pts.get(1).setCentro(new Point(mx, pO.y)); pts.get(2).setCentro(new Point(mx, pD.y));
        } else {
            int my = (pO.y + pD.y) / 2;
            pts.get(1).setCentro(new Point(pO.x, my)); pts.get(2).setCentro(new Point(pD.x, my));
        }
        linha.reSetBounds();
        cmpD.SetFkey(true);
        Constraint pk = ori.getConstraints().stream()
                .filter(c -> c.getTipo() == Constraint.CONSTRAINT_TIPO.tpPK).findFirst().orElse(null);
        Constraint fk = new Constraint(dest);
        fk.setTipo(Constraint.CONSTRAINT_TIPO.tpFK);
        fk.Add(cmpO, cmpD, linha, pk);
        // cardinalidade: lado da PK (1,1) se a FK é NOT NULL, senão (0,1); lado da FK (0,1) se a FK é UNIQUE, senão (0,n)
        if (linha.getCardA() != null && linha.getCardB() != null) {
            linha.getCardA().setCard(obrigatoria ? TiposCard.C11 : TiposCard.C01);
            linha.getCardB().setCard(unica ? TiposCard.C01 : TiposCard.C0N);
        } else {
            System.out.println("linha sem cardinalidade: " + destino + "." + campoFk);
        }
        linha.ajusteSeta();
    }
}
