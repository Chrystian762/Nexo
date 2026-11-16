import controlador.Diagrama;
import controlador.Editor;
import java.awt.Point;
import java.io.File;
import javax.imageio.ImageIO;
import javax.swing.SwingUtilities;
import principal.Aplicacao;

/** Reabre arquivos .brM3 pelo carregador do brModelo e exporta PNG a partir do arquivo reaberto. */
public class Verificar {
    public static void main(String[] args) throws Exception {
        Aplicacao.main(new String[0]);
        while (Aplicacao.fmPrincipal == null || !Aplicacao.fmPrincipal.isVisible()) Thread.sleep(200);
        Thread.sleep(1500);
        SwingUtilities.invokeAndWait(() -> {
            try {
                Editor ed = Aplicacao.fmPrincipal.getEditor();
                for (String caminho : args) {
                    Diagrama d = Diagrama.LoadFromFile(new File(caminho), ed);
                    if (d == null) {
                        System.out.println("FALHOU ao abrir " + caminho);
                        continue;
                    }
                    Point p = d.getPontoExtremo();
                    ImageIO.write(util.ImageGenerate.geraImagemForPrn(d, p.x + 20, p.y + 20), "PNG", new File(caminho + ".reaberto.png"));
                    System.out.println("ABRIU " + new File(caminho).getName() + " tipo=" + d.getTipo() + " objetos=" + d.getListaDeItens().size());
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
        System.exit(0);
    }
}
